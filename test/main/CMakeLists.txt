idf_component_register(
    SRCS "main.c" "main.c"
    INCLUDE_DIRS "."
    REQUIRES esp_wifi driver
    nvs_flash driver
    esp_http_client driver
    PRIV_REQUIRES mbedtls
)