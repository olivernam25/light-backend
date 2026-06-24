#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h" // BẮT BUỘC: Thêm thư viện hàng đợi để truyền dữ liệu giữa 2 Core
#include "driver/i2c_master.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_http_client.h"

static const char *TAG = "BH1750_APP";

// Cấu hình Phần cứng I2C mới
#define I2C_MASTER_SCL_IO 22
#define I2C_MASTER_SDA_IO 21
#define BH1750_SENSOR_ADDR 0x23
#define BH1750_CMD_START 0x10

// Cấu hình mạng Local cá nhân
#define WIFI_SSID "35 T6"
#define WIFI_PASS "60388888"
#define SERVER_IP "192.168.110.36"
#define SERVER_PORT "8800"

#define WIFI_CONNECTED_BIT BIT0
static EventGroupHandle_t wifi_event_group;

static i2c_master_bus_handle_t i2c_bus;
static i2c_master_dev_handle_t bh1750_dev;

// Khai báo Queue trung chuyển dữ liệu Lux giữa nhân 1 và nhân 0
static QueueHandle_t lux_queue = NULL;

/* ==========================================================================
 * Hàm gửi dữ liệu HTTP POST phẳng (Đã giảm timeout tránh nghẽn luồng mạng)
 * ========================================================================== */
void send_json(const char *json)
{
    esp_http_client_config_t config = {
        .url = "http://" SERVER_IP ":" SERVER_PORT "/lux",
        .method = HTTP_METHOD_POST,
        .timeout_ms = 2000, // Giảm xuống 2000ms để thoát nhanh nếu server sập
        .transport_type = HTTP_TRANSPORT_OVER_TCP,
        .crt_bundle_attach = NULL,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client != NULL)
    {
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_header(client, "Connection", "close");
        esp_http_client_set_header(client, "User-Agent", "Mozilla/5.0 (ESP32)");

        char len_str[16];
        int payload_len = strlen(json);
        snprintf(len_str, sizeof(len_str), "%d", payload_len);
        esp_http_client_set_header(client, "Content-Length", len_str);

        esp_http_client_set_post_field(client, json, payload_len);

        esp_err_t err = esp_http_client_perform(client);
        if (err == ESP_OK)
        {
            int status = esp_http_client_get_status_code(client);
            ESP_LOGI(TAG, "Gửi thành công! HTTP Status = %d", status);
        }
        else
        {
            ESP_LOGE(TAG, "Gửi lỗi (Có thể do Node.js chưa bật): %s (0x%x)", esp_err_to_name(err), err);
        }
        esp_http_client_cleanup(client);
    }
}

/* ==========================================================================
 * Wi-Fi Event Handler chuẩn đét
 * ========================================================================== */
static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        esp_wifi_connect();
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED)
    {
        esp_wifi_connect();
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

/* ==========================================================================
 * Khởi tạo Wi-Fi - Đã bỏ hàm block để đẩy việc đợi cấu hình vào Task mạng
 * ========================================================================== */
void wifi_init(void)
{
    wifi_event_group = xEventGroupCreate();

    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        nvs_flash_erase();
        nvs_flash_init();
    }

    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);

    esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL);
    esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL);

    wifi_config_t wifi_config = {
        .sta = {.ssid = WIFI_SSID, .password = WIFI_PASS},
    };

    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi_config);
    esp_wifi_start();
}

/* ==========================================================================
 * TASK 1: ĐỌC DỮ LIỆU CẢM BIẾN I2C (Ghim chạy riêng tại CORE 1)
 * ========================================================================== */
void vSensorTask(void *pvParameters)
{
    // Phát lệnh đánh thức cảm biến đo liên tục độ phân giải cao
    uint8_t cmd = BH1750_CMD_START;
    i2c_master_transmit(bh1750_dev, &cmd, 1, -1);
    vTaskDelay(pdMS_TO_TICKS(180));

    while (1)
    {
        uint8_t data[2];
        if (i2c_master_receive(bh1750_dev, data, 2, -1) == ESP_OK)
        {
            int raw = (data[0] << 8) | data[1];
            int lux = (int)(raw / 1.2);
            printf("[Core 1] Đọc cảm biến thực tế LUX = %d\n", lux);

            // Ghi đè giá trị lux mới nhất vào hàng đợi để Core 0 lấy đi gửi
            xQueueOverwrite(lux_queue, &lux);
        }
        vTaskDelay(pdMS_TO_TICKS(2000)); // Cứ định kỳ 2 giây đọc cảm biến phần cứng một lần
    }
}

/* ==========================================================================
 * TASK 2: XỬ LÝ MẠNG & HTTP CLIENT POST (Ghim chạy riêng tại CORE 0)
 * ========================================================================== */
void vHttpTask(void *pvParameters)
{
    // Chặn luồng Core 0 tại đây đợi cho tới khi chip bắt được IP Wi-Fi thành công
    xEventGroupWaitBits(wifi_event_group, WIFI_CONNECTED_BIT, pdFALSE, pdTRUE, portMAX_DELAY);
    printf("[Core 0] Kết nối WiFi thành công! Bắt đầu luồng đẩy data.\n");

    int lux_to_send = 0;

    while (1)
    {
        // Chờ rút dữ liệu ra khỏi Queue (Đợi tối đa 500ms)
        if (xQueueReceive(lux_queue, &lux_to_send, pdMS_TO_TICKS(500)) == pdTRUE)
        {
            char json[48];
            snprintf(json, sizeof(json), "{\"lux\":%d}", lux_to_send);
            printf("[Core 0] Đang gửi gói tin Internet: %s\n", json);

            // Thực thi gửi gói tin lên database thông qua Node.js công cộng/nội bộ
            send_json(json);
        }

        vTaskDelay(pdMS_TO_TICKS(2000)); // Duy trì nhịp độ bắn gói tin đồng bộ 2 giây
    }
}

/* ==========================================================================
 * Hàm Entry Point chính của chip (Thiết lập đa nhân rồi nhả CPU)
 * ========================================================================== */
void app_main(void)
{
    // 1. Tạo hàng đợi dung lượng 1 phần tử để lưu giữ số Lux
    lux_queue = xQueueCreate(1, sizeof(int));

    // 2. Kích hoạt Driver Wi-Fi (Chỉ bật driver, không chặn xử lý phần cứng)
    wifi_init();

    // 3. Khởi tạo Bus I2C Driver thế hệ mới
    i2c_master_bus_config_t bus_config = {
        .i2c_port = I2C_NUM_0,
        .sda_io_num = I2C_MASTER_SDA_IO,
        .scl_io_num = I2C_MASTER_SCL_IO,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    i2c_new_master_bus(&bus_config, &i2c_bus);

    i2c_device_config_t dev_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = BH1750_SENSOR_ADDR,
        .scl_speed_hz = 100000,
    };
    i2c_master_bus_add_device(i2c_bus, &dev_config, &bh1750_dev);

    // 4. Khởi tạo các Task đa nhiệm ghim trực tiếp vào lõi cứng của ESP32
    xTaskCreatePinnedToCore(
        vSensorTask,   // Hàm thực thi Task
        "Sensor_Task", // Tên định danh Task
        3072,          // Bộ nhớ Stack cấp phát cho Task (3KB)
        NULL,          // Tham số truyền vào
        5,             // Độ ưu tiên cao để đảm bảo việc đọc phần cứng ổn định
        NULL,          // Handler tham chiếu
        1              // Ghim Task này cố định chạy trên LÕI 1 (CORE 1)
    );

    xTaskCreatePinnedToCore(
        vHttpTask,   // Hàm thực thi Task
        "HTTP_Task", // Tên định danh Task
        4096,        // Cấp phát 4KB Stack phục vụ việc xử lý chuỗi mạng nặng
        NULL,        // Tham số truyền vào
        4,           // Mức độ ưu tiên thấp hơn Task phần cứng một chút
        NULL,        // Handler tham chiếu
        0            // Ghim Task này cố định chạy trên LÕI 0 (CORE 0)
    );
}