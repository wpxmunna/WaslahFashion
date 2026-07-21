-- CreateTable
CREATE TABLE `stores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `logo` VARCHAR(255) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `address` TEXT NULL,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stores_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NULL,
    `setting_group` VARCHAR(50) NOT NULL DEFAULT 'general',
    `description` VARCHAR(255) NULL,
    `is_secret` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `settings_store_id_setting_group_idx`(`store_id`, `setting_group`),
    UNIQUE INDEX `settings_store_id_setting_key_key`(`store_id`, `setting_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `avatar` VARCHAR(255) NULL,
    `role` ENUM('CUSTOMER', 'MANAGER', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `email_verified_at` DATETIME(3) NULL,
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `label` VARCHAR(50) NOT NULL DEFAULT 'Home',
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `address_line1` VARCHAR(255) NOT NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NULL,
    `postal_code` VARCHAR(20) NULL,
    `country` VARCHAR(100) NOT NULL DEFAULT 'Bangladesh',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_addresses_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `parent_id` INTEGER NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `image` VARCHAR(255) NULL,
    `icon` VARCHAR(50) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `categories_parent_id_idx`(`parent_id`),
    UNIQUE INDEX `categories_store_id_slug_key`(`store_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `category_id` INTEGER NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `short_description` VARCHAR(500) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `sale_price` DECIMAL(12, 2) NULL,
    `cost_price` DECIMAL(12, 2) NULL,
    `sku` VARCHAR(50) NULL,
    `barcode` VARCHAR(50) NULL,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `low_stock_threshold` INTEGER NOT NULL DEFAULT 5,
    `weight` DECIMAL(8, 2) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `is_new` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ACTIVE', 'INACTIVE', 'DRAFT') NOT NULL DEFAULT 'ACTIVE',
    `meta_title` VARCHAR(255) NULL,
    `meta_description` VARCHAR(500) NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `products_category_id_idx`(`category_id`),
    INDEX `products_status_idx`(`status`),
    INDEX `products_is_featured_idx`(`is_featured`),
    INDEX `products_barcode_idx`(`barcode`),
    UNIQUE INDEX `products_store_id_slug_key`(`store_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `image_path` VARCHAR(255) NOT NULL,
    `alt_text` VARCHAR(255) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_images_product_id_is_primary_idx`(`product_id`, `is_primary`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_colors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `color_code` VARCHAR(7) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `product_colors_store_id_name_key`(`store_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_sizes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(20) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `product_sizes_store_id_name_key`(`store_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `color_id` INTEGER NULL,
    `size` VARCHAR(20) NULL,
    `color` VARCHAR(50) NULL,
    `color_code` VARCHAR(7) NULL,
    `sku` VARCHAR(50) NULL,
    `price_modifier` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_variants_product_id_idx`(`product_id`),
    UNIQUE INDEX `product_variants_product_id_size_color_key`(`product_id`, `size`, `color`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL DEFAULT 1,
    `user_id` INTEGER NULL,
    `token` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `carts_token_key`(`token`),
    INDEX `carts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cart_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `variant_id` INTEGER NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `price` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cart_items_cart_id_idx`(`cart_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wishlist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wishlist_user_id_product_id_key`(`user_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `rating` TINYINT NOT NULL,
    `title` VARCHAR(255) NULL,
    `comment` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `reviews_product_id_status_idx`(`product_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL DEFAULT 1,
    `user_id` INTEGER NULL,
    `order_number` VARCHAR(50) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `payment_status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `payment_method` VARCHAR(50) NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `coupon_id` INTEGER NULL,
    `coupon_code` VARCHAR(50) NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `shipping_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `shipping_name` VARCHAR(100) NULL,
    `shipping_phone` VARCHAR(20) NULL,
    `shipping_address_line1` VARCHAR(255) NULL,
    `shipping_address_line2` VARCHAR(255) NULL,
    `shipping_city` VARCHAR(100) NULL,
    `shipping_state` VARCHAR(100) NULL,
    `shipping_postal_code` VARCHAR(20) NULL,
    `shipping_country` VARCHAR(100) NULL,
    `billing_name` VARCHAR(100) NULL,
    `billing_phone` VARCHAR(20) NULL,
    `billing_address_line1` VARCHAR(255) NULL,
    `billing_address_line2` VARCHAR(255) NULL,
    `billing_city` VARCHAR(100) NULL,
    `billing_state` VARCHAR(100) NULL,
    `billing_postal_code` VARCHAR(20) NULL,
    `billing_country` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `admin_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_order_number_key`(`order_number`),
    INDEX `orders_store_id_status_idx`(`store_id`, `status`),
    INDEX `orders_user_id_idx`(`user_id`),
    INDEX `orders_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `variant_id` INTEGER NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `product_sku` VARCHAR(50) NULL,
    `variant_info` VARCHAR(100) NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `total_price` DECIMAL(12, 2) NOT NULL,
    `is_gift` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `transaction_id` VARCHAR(100) NULL,
    `gateway` VARCHAR(50) NOT NULL,
    `method` VARCHAR(50) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'BDT',
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `gateway_response` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payments_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `couriers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `logo` VARCHAR(255) NULL,
    `base_rate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `per_kg_rate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `estimated_days` VARCHAR(20) NULL,
    `tracking_url` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `couriers_store_id_code_key`(`store_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `courier_id` INTEGER NULL,
    `courier_name` VARCHAR(100) NULL,
    `tracking_number` VARCHAR(100) NULL,
    `status` ENUM('PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `delivery_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `pathao_status` VARCHAR(100) NULL,
    `shipped_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shipments_order_id_key`(`order_id`),
    INDEX `shipments_tracking_number_idx`(`tracking_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_tracking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shipment_id` INTEGER NOT NULL,
    `status` VARCHAR(100) NOT NULL,
    `location` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `tracked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shipment_tracking_shipment_id_idx`(`shipment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `returns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `order_id` INTEGER NOT NULL,
    `return_number` VARCHAR(50) NOT NULL,
    `reason` ENUM('DEFECTIVE', 'DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'CHANGED_MIND', 'CUSTOMER_REFUSED', 'UNDELIVERED', 'OTHER') NOT NULL,
    `reason_details` TEXT NULL,
    `refund_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `refund_status` ENUM('NOT_REQUIRED', 'PENDING', 'COMPLETED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `admin_notes` TEXT NULL,
    `returned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `returns_order_id_idx`(`order_id`),
    UNIQUE INDEX `returns_store_id_return_number_key`(`store_id`, `return_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `return_id` INTEGER NOT NULL,
    `order_item_id` INTEGER NULL,
    `product_id` INTEGER NULL,
    `variant_id` INTEGER NULL,
    `product_name` VARCHAR(255) NULL,
    `variant_info` VARCHAR(100) NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NULL,
    `stock_restored` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `return_items_return_id_idx`(`return_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coupons` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `type` ENUM('FIXED', 'PERCENTAGE', 'FREE_SHIPPING', 'GIFT_ITEM', 'BUY_X_GET_Y') NOT NULL DEFAULT 'FIXED',
    `value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `minimum_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `maximum_discount` DECIMAL(12, 2) NULL,
    `gift_product_id` INTEGER NULL,
    `buy_quantity` INTEGER NULL,
    `get_quantity` INTEGER NULL,
    `usage_limit` INTEGER NULL,
    `used_count` INTEGER NOT NULL DEFAULT 0,
    `starts_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `coupons_store_id_code_key`(`store_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sliders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `subtitle` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `button_text` VARCHAR(100) NULL,
    `button_link` VARCHAR(255) NULL,
    `button2_text` VARCHAR(100) NULL,
    `button2_link` VARCHAR(255) NULL,
    `image` VARCHAR(255) NULL,
    `text_position` ENUM('LEFT', 'CENTER', 'RIGHT') NOT NULL DEFAULT 'LEFT',
    `text_color` VARCHAR(20) NOT NULL DEFAULT '#ffffff',
    `overlay_opacity` DECIMAL(3, 2) NOT NULL DEFAULT 0.40,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sliders_store_id_is_active_sort_order_idx`(`store_id`, `is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lookbook` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `image` VARCHAR(255) NOT NULL,
    `link` VARCHAR(255) NULL,
    `caption` VARCHAR(255) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lookbook_store_id_is_active_sort_order_idx`(`store_id`, `is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `platform` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `icon` VARCHAR(100) NOT NULL,
    `icon_style` ENUM('BRANDS', 'SOLID', 'REGULAR') NOT NULL DEFAULT 'BRANDS',
    `color` VARCHAR(20) NOT NULL DEFAULT '#000000',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `show_in_header` BOOLEAN NOT NULL DEFAULT false,
    `show_in_footer` BOOLEAN NOT NULL DEFAULT true,
    `open_new_tab` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_media_store_id_is_active_sort_order_idx`(`store_id`, `is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_terminals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `terminal_name` VARCHAR(100) NOT NULL,
    `terminal_code` VARCHAR(20) NOT NULL,
    `location` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pos_terminals_store_id_terminal_code_key`(`store_id`, `terminal_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_shifts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `terminal_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `shift_number` VARCHAR(50) NOT NULL,
    `opening_time` DATETIME(3) NOT NULL,
    `closing_time` DATETIME(3) NULL,
    `opening_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `expected_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `actual_cash` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `cash_difference` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_sales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_transactions` INTEGER NOT NULL DEFAULT 0,
    `total_refunds` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pos_shifts_shift_number_key`(`shift_number`),
    INDEX `pos_shifts_store_id_status_idx`(`store_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `terminal_id` INTEGER NULL,
    `transaction_number` VARCHAR(50) NOT NULL,
    `customer_id` INTEGER NULL,
    `customer_name` VARCHAR(255) NULL,
    `customer_phone` VARCHAR(50) NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(14, 2) NOT NULL,
    `payment_method` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'MIXED') NOT NULL DEFAULT 'CASH',
    `cash_received` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `change_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `card_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `mobile_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` ENUM('COMPLETED', 'REFUNDED', 'VOID') NOT NULL DEFAULT 'COMPLETED',
    `refunded_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pos_transactions_transaction_number_key`(`transaction_number`),
    INDEX `pos_transactions_store_id_created_at_idx`(`store_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_transaction_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `product_sku` VARCHAR(100) NULL,
    `variant_id` INTEGER NULL,
    `variant_info` VARCHAR(255) NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_price` DECIMAL(14, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pos_transaction_items_transaction_id_idx`(`transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_cash_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `shift_id` INTEGER NOT NULL,
    `log_type` ENUM('CASH_IN', 'CASH_OUT', 'ADJUSTMENT') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `reference` VARCHAR(100) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pos_cash_logs_shift_id_idx`(`shift_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_held_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `terminal_id` INTEGER NULL,
    `hold_number` VARCHAR(50) NOT NULL,
    `customer_id` INTEGER NULL,
    `customer_name` VARCHAR(255) NULL,
    `customer_phone` VARCHAR(50) NULL,
    `items_json` JSON NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('HELD', 'RECALLED', 'EXPIRED') NOT NULL DEFAULT 'HELD',
    `held_by` INTEGER NULL,
    `recalled_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pos_held_orders_hold_number_key`(`hold_number`),
    INDEX `pos_held_orders_store_id_status_idx`(`store_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_refunds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `shift_id` INTEGER NULL,
    `terminal_id` INTEGER NULL,
    `transaction_id` INTEGER NOT NULL,
    `refund_number` VARCHAR(50) NOT NULL,
    `customer_id` INTEGER NULL,
    `customer_name` VARCHAR(255) NULL,
    `refund_amount` DECIMAL(14, 2) NOT NULL,
    `refund_method` ENUM('CASH', 'CARD', 'STORE_CREDIT', 'ORIGINAL_METHOD') NOT NULL DEFAULT 'CASH',
    `reason` VARCHAR(100) NULL,
    `items_json` JSON NULL,
    `notes` TEXT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pos_refunds_refund_number_key`(`refund_number`),
    INDEX `pos_refunds_store_id_status_idx`(`store_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_split_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_id` INTEGER NOT NULL,
    `payment_method` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'MIXED') NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `reference_number` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pos_split_payments_transaction_id_idx`(`transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) NULL,
    `description` TEXT NULL,
    `manager_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `departments_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `user_id` INTEGER NULL,
    `employee_id` VARCHAR(20) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `date_of_birth` DATE NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `national_id` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `department_id` INTEGER NULL,
    `designation` VARCHAR(100) NULL,
    `employment_type` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN') NOT NULL DEFAULT 'FULL_TIME',
    `hire_date` DATE NOT NULL,
    `termination_date` DATE NULL,
    `basic_salary` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `bank_name` VARCHAR(100) NULL,
    `bank_account` VARCHAR(50) NULL,
    `mobile_banking` VARCHAR(50) NULL,
    `emergency_contact_name` VARCHAR(255) NULL,
    `emergency_contact_phone` VARCHAR(50) NULL,
    `photo` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED') NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_user_id_key`(`user_id`),
    INDEX `employees_department_id_idx`(`department_id`),
    UNIQUE INDEX `employees_store_id_employee_id_key`(`store_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `attendance_date` DATE NOT NULL,
    `check_in` TIME NULL,
    `check_out` TIME NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'HOLIDAY') NOT NULL DEFAULT 'PRESENT',
    `work_hours` DECIMAL(4, 2) NOT NULL DEFAULT 0,
    `overtime_hours` DECIMAL(4, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_store_id_attendance_date_idx`(`store_id`, `attendance_date`),
    UNIQUE INDEX `attendance_employee_id_attendance_date_key`(`employee_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `days_per_year` INTEGER NOT NULL DEFAULT 0,
    `is_paid` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `leave_types_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `leave_type_id` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `days` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `leave_requests_employee_id_status_idx`(`employee_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('EARNING', 'DEDUCTION') NOT NULL,
    `calculation_type` ENUM('FIXED', 'PERCENTAGE') NOT NULL DEFAULT 'FIXED',
    `default_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `percentage_of` VARCHAR(50) NULL,
    `is_taxable` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `salary_components_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_salary_structure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `component_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_salary_structure_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_periods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `period_name` VARCHAR(100) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `pay_date` DATE NULL,
    `status` ENUM('DRAFT', 'PROCESSING', 'APPROVED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `total_employees` INTEGER NOT NULL DEFAULT 0,
    `total_gross` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_deductions` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_net` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `processed_by` INTEGER NULL,
    `processed_at` DATETIME(3) NULL,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_periods_store_id_status_idx`(`store_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payroll_period_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `basic_salary` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `working_days` INTEGER NOT NULL DEFAULT 0,
    `present_days` INTEGER NOT NULL DEFAULT 0,
    `absent_days` INTEGER NOT NULL DEFAULT 0,
    `leave_days` INTEGER NOT NULL DEFAULT 0,
    `overtime_hours` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `overtime_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gross_earnings` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_deductions` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `net_salary` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `payment_method` ENUM('BANK', 'CASH', 'MOBILE_BANKING') NOT NULL DEFAULT 'BANK',
    `payment_status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `paid_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payroll_details_payroll_period_id_employee_id_key`(`payroll_period_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_detail_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payroll_detail_id` INTEGER NOT NULL,
    `component_id` INTEGER NOT NULL,
    `component_name` VARCHAR(100) NOT NULL,
    `component_type` ENUM('EARNING', 'DEDUCTION') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payroll_detail_components_payroll_detail_id_idx`(`payroll_detail_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NOT NULL DEFAULT '#6c757d',
    `icon` VARCHAR(50) NOT NULL DEFAULT 'tag',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `expense_categories_store_id_slug_key`(`store_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `category_id` INTEGER NULL,
    `expense_number` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `expense_date` DATE NOT NULL,
    `payment_method` ENUM('CASH', 'BANK_TRANSFER', 'MOBILE_BANKING', 'CARD', 'OTHER') NOT NULL DEFAULT 'CASH',
    `payment_status` ENUM('PENDING', 'PAID', 'PARTIAL') NOT NULL DEFAULT 'PENDING',
    `reference_number` VARCHAR(100) NULL,
    `vendor_name` VARCHAR(255) NULL,
    `receipt_path` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `expenses_expense_number_key`(`expense_number`),
    INDEX `expenses_store_id_expense_date_idx`(`store_id`, `expense_date`),
    INDEX `expenses_payment_status_idx`(`payment_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NULL,
    `contact_person` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `country` VARCHAR(100) NOT NULL DEFAULT 'Bangladesh',
    `payment_terms` INTEGER NOT NULL DEFAULT 30,
    `notes` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `total_purchases` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_paid` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `suppliers_store_id_status_idx`(`store_id`, `status`),
    INDEX `suppliers_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `po_number` VARCHAR(50) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `order_date` DATE NOT NULL,
    `expected_date` DATE NULL,
    `received_date` DATE NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `shipping_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `payment_status` ENUM('PENDING', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'PENDING',
    `paid_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_by` INTEGER NULL,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_orders_po_number_key`(`po_number`),
    INDEX `purchase_orders_store_id_status_idx`(`store_id`, `status`),
    INDEX `purchase_orders_supplier_id_idx`(`supplier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchase_order_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `product_sku` VARCHAR(100) NULL,
    `variant_id` INTEGER NULL,
    `variant_info` VARCHAR(255) NULL,
    `quantity_ordered` INTEGER NOT NULL,
    `quantity_received` INTEGER NOT NULL DEFAULT 0,
    `unit_cost` DECIMAL(12, 2) NOT NULL,
    `total_cost` DECIMAL(14, 2) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `purchase_order_items_purchase_order_id_idx`(`purchase_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `purchase_order_id` INTEGER NULL,
    `payment_number` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_method` ENUM('CASH', 'BANK_TRANSFER', 'CHECK', 'MOBILE_BANKING', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
    `reference_number` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `supplier_payments_payment_number_key`(`payment_number`),
    INDEX `supplier_payments_supplier_id_idx`(`supplier_id`),
    INDEX `supplier_payments_payment_date_idx`(`payment_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chart_of_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `account_code` VARCHAR(20) NOT NULL,
    `account_name` VARCHAR(255) NOT NULL,
    `account_type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS') NOT NULL,
    `parent_id` INTEGER NULL,
    `description` TEXT NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `normal_balance` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `current_balance` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chart_of_accounts_account_type_idx`(`account_type`),
    UNIQUE INDEX `chart_of_accounts_store_id_account_code_key`(`store_id`, `account_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `entry_number` VARCHAR(50) NOT NULL,
    `entry_date` DATE NOT NULL,
    `description` TEXT NOT NULL,
    `reference_type` ENUM('MANUAL', 'ORDER', 'EXPENSE', 'PURCHASE', 'RETURN', 'PAYMENT', 'ADJUSTMENT') NOT NULL DEFAULT 'MANUAL',
    `reference_id` INTEGER NULL,
    `total_debit` DECIMAL(14, 2) NOT NULL,
    `total_credit` DECIMAL(14, 2) NOT NULL,
    `status` ENUM('DRAFT', 'POSTED', 'REVERSED') NOT NULL DEFAULT 'DRAFT',
    `posted_at` DATETIME(3) NULL,
    `posted_by` INTEGER NULL,
    `reversed_by_id` INTEGER NULL,
    `notes` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `journal_entries_entry_number_key`(`entry_number`),
    INDEX `journal_entries_store_id_entry_date_idx`(`store_id`, `entry_date`),
    INDEX `journal_entries_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    INDEX `journal_entries_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entry_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `journal_entry_id` INTEGER NOT NULL,
    `account_id` INTEGER NOT NULL,
    `description` VARCHAR(255) NULL,
    `debit_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `credit_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `journal_entry_lines_journal_entry_id_idx`(`journal_entry_id`),
    INDEX `journal_entry_lines_account_id_idx`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `platform` ENUM('ALL', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'TWITTER') NOT NULL DEFAULT 'ALL',
    `message_type` ENUM('PROMOTION', 'ANNOUNCEMENT', 'GREETING', 'OFFER', 'EVENT', 'CUSTOM') NOT NULL DEFAULT 'PROMOTION',
    `content` TEXT NOT NULL,
    `short_content` VARCHAR(500) NULL,
    `hashtags` VARCHAR(500) NULL,
    `call_to_action` VARCHAR(255) NULL,
    `cta_url` VARCHAR(500) NULL,
    `image_path` VARCHAR(255) NULL,
    `scheduled_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `copy_count` INTEGER NOT NULL DEFAULT 0,
    `total_views` INTEGER NOT NULL DEFAULT 0,
    `total_clicks` INTEGER NOT NULL DEFAULT 0,
    `total_shares` INTEGER NOT NULL DEFAULT 0,
    `total_engagements` INTEGER NOT NULL DEFAULT 0,
    `conversion_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `last_activity_at` DATETIME(3) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `campaign_messages_store_id_is_active_idx`(`store_id`, `is_active`),
    INDEX `campaign_messages_platform_is_active_idx`(`platform`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_analytics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaign_id` INTEGER NOT NULL,
    `event_type` ENUM('VIEW', 'COPY', 'CLICK', 'SHARE', 'ENGAGEMENT') NOT NULL,
    `platform` VARCHAR(50) NULL,
    `source` VARCHAR(100) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `referrer` VARCHAR(500) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `campaign_analytics_campaign_id_event_type_idx`(`campaign_id`, `event_type`),
    INDEX `campaign_analytics_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_daily_stats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaign_id` INTEGER NOT NULL,
    `stat_date` DATE NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `copies` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `shares` INTEGER NOT NULL DEFAULT 0,
    `engagements` INTEGER NOT NULL DEFAULT 0,
    `unique_views` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `campaign_daily_stats_stat_date_idx`(`stat_date`),
    UNIQUE INDEX `campaign_daily_stats_campaign_id_stat_date_key`(`campaign_id`, `stat_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_goals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaign_id` INTEGER NOT NULL,
    `goal_type` ENUM('VIEWS', 'COPIES', 'CLICKS', 'SHARES', 'ENGAGEMENTS') NOT NULL,
    `target_value` INTEGER NOT NULL,
    `current_value` INTEGER NOT NULL DEFAULT 0,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `is_achieved` BOOLEAN NOT NULL DEFAULT false,
    `achieved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `campaign_goals_campaign_id_idx`(`campaign_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_notes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaign_id` INTEGER NOT NULL,
    `user_id` INTEGER NULL,
    `note` TEXT NOT NULL,
    `note_type` ENUM('GENERAL', 'PERFORMANCE', 'ISSUE', 'IDEA') NOT NULL DEFAULT 'GENERAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `campaign_notes_campaign_id_idx`(`campaign_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_integrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'WHATSAPP') NOT NULL,
    `page_id` VARCHAR(100) NULL,
    `page_name` VARCHAR(255) NULL,
    `page_access_token` TEXT NULL,
    `user_access_token` TEXT NULL,
    `token_expires_at` DATETIME(3) NULL,
    `phone_number_id` VARCHAR(100) NULL,
    `whatsapp_business_id` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_sync_at` DATETIME(3) NULL,
    `settings` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `meta_integrations_store_id_platform_key`(`store_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'WHATSAPP') NOT NULL,
    `message_id` VARCHAR(255) NOT NULL,
    `conversation_id` VARCHAR(255) NULL,
    `sender_id` VARCHAR(100) NULL,
    `sender_name` VARCHAR(255) NULL,
    `sender_profile_pic` VARCHAR(500) NULL,
    `recipient_id` VARCHAR(100) NULL,
    `message_type` ENUM('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'TEMPLATE', 'INTERACTIVE') NOT NULL DEFAULT 'TEXT',
    `content` TEXT NULL,
    `media_url` VARCHAR(500) NULL,
    `is_incoming` BOOLEAN NOT NULL DEFAULT true,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'SENT',
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `meta_messages_message_id_key`(`message_id`),
    INDEX `meta_messages_conversation_id_idx`(`conversation_id`),
    INDEX `meta_messages_sender_id_idx`(`sender_id`),
    INDEX `meta_messages_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_page_insights` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM', 'WHATSAPP') NOT NULL,
    `page_id` VARCHAR(100) NOT NULL,
    `metric_name` VARCHAR(100) NOT NULL,
    `metric_value` DECIMAL(14, 2) NULL,
    `period` ENUM('DAY', 'WEEK', 'MONTH', 'LIFETIME') NOT NULL DEFAULT 'DAY',
    `stat_date` DATE NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `meta_page_insights_stat_date_idx`(`stat_date`),
    UNIQUE INDEX `meta_page_insights_store_id_platform_page_id_metric_name_sta_key`(`store_id`, `platform`, `page_id`, `metric_name`, `stat_date`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_message_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `template_id` VARCHAR(100) NULL,
    `name` VARCHAR(255) NOT NULL,
    `language` VARCHAR(10) NOT NULL DEFAULT 'en',
    `category` ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION') NOT NULL DEFAULT 'MARKETING',
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `components` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `meta_message_templates_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `settings` ADD CONSTRAINT `settings_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_addresses` ADD CONSTRAINT `user_addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_colors` ADD CONSTRAINT `product_colors_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_sizes` ADD CONSTRAINT `product_sizes_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_color_id_fkey` FOREIGN KEY (`color_id`) REFERENCES `product_colors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cart_id_fkey` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wishlist` ADD CONSTRAINT `wishlist_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wishlist` ADD CONSTRAINT `wishlist_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `couriers` ADD CONSTRAINT `couriers_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_courier_id_fkey` FOREIGN KEY (`courier_id`) REFERENCES `couriers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipment_tracking` ADD CONSTRAINT `shipment_tracking_shipment_id_fkey` FOREIGN KEY (`shipment_id`) REFERENCES `shipments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returns` ADD CONSTRAINT `returns_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returns` ADD CONSTRAINT `returns_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_return_id_fkey` FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_gift_product_id_fkey` FOREIGN KEY (`gift_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sliders` ADD CONSTRAINT `sliders_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lookbook` ADD CONSTRAINT `lookbook_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_media` ADD CONSTRAINT `social_media_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_terminals` ADD CONSTRAINT `pos_terminals_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_shifts` ADD CONSTRAINT `pos_shifts_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_shifts` ADD CONSTRAINT `pos_shifts_terminal_id_fkey` FOREIGN KEY (`terminal_id`) REFERENCES `pos_terminals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_shifts` ADD CONSTRAINT `pos_shifts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `pos_shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_terminal_id_fkey` FOREIGN KEY (`terminal_id`) REFERENCES `pos_terminals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transaction_items` ADD CONSTRAINT `pos_transaction_items_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `pos_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transaction_items` ADD CONSTRAINT `pos_transaction_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_cash_logs` ADD CONSTRAINT `pos_cash_logs_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_cash_logs` ADD CONSTRAINT `pos_cash_logs_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `pos_shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_cash_logs` ADD CONSTRAINT `pos_cash_logs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_held_orders` ADD CONSTRAINT `pos_held_orders_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_held_orders` ADD CONSTRAINT `pos_held_orders_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `pos_shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_held_orders` ADD CONSTRAINT `pos_held_orders_terminal_id_fkey` FOREIGN KEY (`terminal_id`) REFERENCES `pos_terminals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_held_orders` ADD CONSTRAINT `pos_held_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_held_orders` ADD CONSTRAINT `pos_held_orders_held_by_fkey` FOREIGN KEY (`held_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_refunds` ADD CONSTRAINT `pos_refunds_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_refunds` ADD CONSTRAINT `pos_refunds_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `pos_shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_refunds` ADD CONSTRAINT `pos_refunds_terminal_id_fkey` FOREIGN KEY (`terminal_id`) REFERENCES `pos_terminals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_refunds` ADD CONSTRAINT `pos_refunds_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `pos_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_refunds` ADD CONSTRAINT `pos_refunds_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_refunds` ADD CONSTRAINT `pos_refunds_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_split_payments` ADD CONSTRAINT `pos_split_payments_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `pos_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_types` ADD CONSTRAINT `leave_types_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_components` ADD CONSTRAINT `salary_components_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salary_structure` ADD CONSTRAINT `employee_salary_structure_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salary_structure` ADD CONSTRAINT `employee_salary_structure_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `salary_components`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_periods` ADD CONSTRAINT `payroll_periods_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_periods` ADD CONSTRAINT `payroll_periods_processed_by_fkey` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_periods` ADD CONSTRAINT `payroll_periods_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_details` ADD CONSTRAINT `payroll_details_payroll_period_id_fkey` FOREIGN KEY (`payroll_period_id`) REFERENCES `payroll_periods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_details` ADD CONSTRAINT `payroll_details_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_detail_components` ADD CONSTRAINT `payroll_detail_components_payroll_detail_id_fkey` FOREIGN KEY (`payroll_detail_id`) REFERENCES `payroll_details`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_detail_components` ADD CONSTRAINT `payroll_detail_components_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `salary_components`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_categories` ADD CONSTRAINT `expense_categories_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_reversed_by_id_fkey` FOREIGN KEY (`reversed_by_id`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `journal_entry_lines_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `journal_entry_lines_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_messages` ADD CONSTRAINT `campaign_messages_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_messages` ADD CONSTRAINT `campaign_messages_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_analytics` ADD CONSTRAINT `campaign_analytics_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaign_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_daily_stats` ADD CONSTRAINT `campaign_daily_stats_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaign_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_goals` ADD CONSTRAINT `campaign_goals_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaign_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_notes` ADD CONSTRAINT `campaign_notes_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaign_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_notes` ADD CONSTRAINT `campaign_notes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_integrations` ADD CONSTRAINT `meta_integrations_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_messages` ADD CONSTRAINT `meta_messages_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_page_insights` ADD CONSTRAINT `meta_page_insights_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meta_message_templates` ADD CONSTRAINT `meta_message_templates_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
