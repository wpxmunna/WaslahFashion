/*
  Warnings:

  - You are about to drop the column `size_chart` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `products` DROP COLUMN `size_chart`,
    ADD COLUMN `size_chart_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `size_charts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `size_charts_store_id_idx`(`store_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `products_size_chart_id_idx` ON `products`(`size_chart_id`);

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_size_chart_id_fkey` FOREIGN KEY (`size_chart_id`) REFERENCES `size_charts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `size_charts` ADD CONSTRAINT `size_charts_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
