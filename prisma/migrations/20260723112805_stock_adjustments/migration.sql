-- CreateTable
CREATE TABLE `stock_adjustments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `variant_id` INTEGER NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `variant_info` VARCHAR(120) NULL,
    `delta` INTEGER NOT NULL,
    `new_quantity` INTEGER NOT NULL,
    `reason` VARCHAR(50) NOT NULL,
    `note` TEXT NULL,
    `staff_name` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_adjustments_store_id_created_at_idx`(`store_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
