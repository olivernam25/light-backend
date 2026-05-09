#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_log.h"
#include "esp_http_client.h"
#include "nvs_flash.h"
#include <string.h>

static const char *TAG = "LIGHTSENSE";

// ════════════════════════════════════════════════════════
// CẤU HÌNH PHẦN CỨNG
// ════════════════════════════════════════════════════════
#define I2C_MASTER_SCL_IO 22
#define I2C_MASTER_SDA_IO 21
#define BH1750_SENSOR_ADDR 0x23
#define BH1750_CMD_START 0x10

// ════════════════════════════════════════════════════════
// CẤU HÌNH WIFI & SERVER
// ════════════════════════════════════════════════════════
#define WIFI_SSID "tmp"
#define WIFI_PASS "22446688"
#define WIFI_MAX_RETRY 10

// ⚠️ QUAN TRỌNG: Kiểm tra lại ipconfig để điền đúng số IP này
#define SERVER_IP "192.168.137.1"
#define SERVER_PORT "8800"

// ════════════════════════════════════════════════════════
// BIẾN TOÀN CỤC
// ════════════════════════════════════════════════════════
static EventGroupHandle_t wifi_event_group;
#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1

static int s_retry_num = 0;
static int is_connected = 0;
static i2c_master_bus_handle_t i2c_bus;
static i2c_master_dev_handle_t bh1750_dev;

// ════════════════════════════════════════════════════════
// HÀM GỬI DỮ LIỆU - ĐÃ FIX LỖI SELECT() TIMEOUT
// ════════════════════════════════════════════════════════
static void send_to_server(uint16_t lux)
{
    char body[64];
    int len = snprintf(body, sizeof(body), "{\"lux\":%d}", lux);

    esp_http_client_config_t config = {
        .url = "http://" SERVER_IP ":" SERVER_PORT "/lux",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 15000, // Tăng timeout lên 15s

        // 🔥 CHIÊU CUỐI: Ép dùng TCP thường, tuyệt đối không dùng TLS (SSL)
        .transport_type = HTTP_TRANSPORT_OVER_TCP,

        // 🚀 TĂNG BUFFER: Fix lỗi nghẽn socket (Theo GitHub Issue #12328)
        .buffer_size = 2048,
        .buffer_size_tx = 2048,
        .is_async = false,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL)
    {
        ESP_LOGE(TAG, "Khoi tao client THAT BAI");
        return;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, body, len);

    ESP_LOGI(TAG, "Dang gui den: %s", config.url);
    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK)
    {
        int status = esp_http_client_get_status_code(client);
        if (status == 200 || status == 201)
        {
            ESP_LOGI(TAG, "🟢 CHÚC MỪNG! POST OK | Lux: %d", lux);
        }
        else
        {
            ESP_LOGW(TAG, "🟠 Server phan hoi loi: %d", status);
        }
    }
    else
    {
        // In chi tiết mã lỗi để debug nếu vẫn tịt
        ESP_LOGE(TAG, "🔴 LOI KET NOI: %s (0x%x)", esp_err_to_name(err), err);
    }

    esp_http_client_cleanup(client);
}

// ════════════════════════════════════════════════════════
// WIFI & EVENT HANDLER (GIỮ NGUYÊN NHƯNG LÀM SẠCH)
// ════════════════════════════════════════════════════════
static void wifi_event_handler(void *arg, esp_event_base_t base, int32_t event_id, void *event_data)
{
    if (base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        esp_wifi_connect();
    }
    else if (base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED)
    {
        if (s_retry_num < WIFI_MAX_RETRY)
        {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGI(TAG, "Dang thu ket noi lai... (%d/%d)", s_retry_num, WIFI_MAX_RETRY);
        }
        else
        {
            xEventGroupSetBits(wifi_event_group, WIFI_FAIL_BIT);
        }
        is_connected = 0;
    }
    else if (base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        ESP_LOGI(TAG, "DA KET NOI! IP: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        is_connected = 1;
        xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

static void wifi_init_sta(void)
{
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event_handler, NULL, NULL));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());
    xEventGroupWaitBits(wifi_event_group, WIFI_CONNECTED_BIT | WIFI_FAIL_BIT, pdFALSE, pdFALSE, portMAX_DELAY);
}

// ════════════════════════════════════════════════════════
// CẢM BIẾN & MAIN
// ════════════════════════════════════════════════════════
static esp_err_t i2c_master_init(void)
{
    i2c_master_bus_config_t bus_config = {
        .i2c_port = I2C_NUM_0,
        .sda_io_num = I2C_MASTER_SDA_IO,
        .scl_io_num = I2C_MASTER_SCL_IO,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    i2c_new_master_bus(&bus_config, &i2c_bus);
    i2c_device_config_t dev_config = {.dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = BH1750_SENSOR_ADDR, .scl_speed_hz = 100000};
    return i2c_master_bus_add_device(i2c_bus, &dev_config, &bh1750_dev);
}

static void bh1750_task(void *pvParameters)
{
    uint8_t cmd = BH1750_CMD_START;
    i2c_master_transmit(bh1750_dev, &cmd, 1, -1);
    vTaskDelay(pdMS_TO_TICKS(200));
    while (1)
    {
        uint8_t data[2];
        if (i2c_master_receive(bh1750_dev, data, 2, -1) == ESP_OK)
        {
            uint16_t lux = (data[0] << 8 | data[1]) / 1.2;
            ESP_LOGI(TAG, "Gia tri: %d Lux", lux);
            if (is_connected)
                send_to_server(lux);
        }
        vTaskDelay(pdMS_TO_TICKS(15000));
    }
}

void app_main(void)
{
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        nvs_flash_init();
    }
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    wifi_event_group = xEventGroupCreate();
    ESP_ERROR_CHECK(i2c_master_init());
    wifi_init_sta();
    xTaskCreate(bh1750_task, "bh1750_task", 4096, NULL, 5, NULL);
}
