import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) });

// Remote photography for the demo catalogue. Product `path` accepts either an
// absolute URL or an upload-relative path (see `imageUrl()` in lib/images.ts).
const PHOTO = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

async function main() {
  console.log("Seeding Waslah…");

  // --- Store ---------------------------------------------------------------
  const store = await prisma.store.upsert({
    where: { slug: "waslah" },
    update: {},
    create: {
      id: 1,
      name: "Waslah",
      slug: "waslah",
      description: "Authenticity in Every Stitch",
      email: "info@waslah.com",
      phone: "+880 1700 000000",
      address: "Gulshan Avenue, Dhaka 1212, Bangladesh",
      isDefault: true,
    },
  });

  // --- Users ---------------------------------------------------------------
  const adminPassword = await bcrypt.hash("admin1234", 12);
  const customerPassword = await bcrypt.hash("customer1234", 12);

  await prisma.user.upsert({
    where: { email: "admin@waslah.com" },
    update: {},
    create: {
      storeId: store.id,
      name: "Waslah Admin",
      email: "admin@waslah.com",
      passwordHash: adminPassword,
      role: "ADMIN",
      phone: "+880 1700 000001",
    },
  });

  // A manager can reach the admin panel but is locked out of the full-admin
  // screens (settings, stores, staff, payroll, accounting).
  await prisma.user.upsert({
    where: { email: "manager@waslah.com" },
    update: {},
    create: {
      storeId: store.id,
      name: "Waslah Manager",
      email: "manager@waslah.com",
      passwordHash: await bcrypt.hash("manager1234", 12),
      role: "MANAGER",
      phone: "+880 1700 000003",
    },
  });

  await prisma.user.upsert({
    where: { email: "customer@waslah.com" },
    update: {},
    create: {
      storeId: store.id,
      name: "Ayesha Rahman",
      email: "customer@waslah.com",
      passwordHash: customerPassword,
      role: "CUSTOMER",
      phone: "+880 1700 000002",
      addresses: {
        create: {
          label: "Home",
          name: "Ayesha Rahman",
          phone: "+880 1700 000002",
          addressLine1: "House 42, Road 11",
          addressLine2: "Banani",
          city: "Dhaka",
          state: "Dhaka",
          postalCode: "1213",
          country: "Bangladesh",
          isDefault: true,
        },
      },
    },
  });

  // --- Categories ----------------------------------------------------------
  const categorySpec = [
    {
      name: "Women",
      slug: "women",
      image: PHOTO("photo-1483985988355-763728e1935b"),
      children: [
        { name: "Sarees", slug: "sarees" },
        { name: "Salwar Kameez", slug: "salwar-kameez" },
        { name: "Kurtis", slug: "kurtis" },
      ],
    },
    {
      name: "Men",
      slug: "men",
      image: PHOTO("photo-1516257984-b1b4d707412e"),
      children: [
        { name: "Panjabi", slug: "panjabi" },
        { name: "Shirts", slug: "shirts" },
        { name: "T-Shirts", slug: "t-shirts" },
      ],
    },
    {
      name: "Children",
      slug: "children",
      image: PHOTO("photo-1519238263530-99bdd11df2ea"),
      children: [
        { name: "Girls", slug: "girls" },
        { name: "Boys", slug: "boys" },
      ],
    },
  ];

  const categoryIds = new Map<string, number>();

  for (const [i, spec] of categorySpec.entries()) {
    const parent = await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: spec.slug } },
      update: {},
      create: {
        storeId: store.id,
        name: spec.name,
        slug: spec.slug,
        image: spec.image,
        sortOrder: i,
      },
    });
    categoryIds.set(spec.slug, parent.id);

    for (const [j, child] of spec.children.entries()) {
      const c = await prisma.category.upsert({
        where: { storeId_slug: { storeId: store.id, slug: child.slug } },
        update: {},
        create: {
          storeId: store.id,
          parentId: parent.id,
          name: child.name,
          slug: child.slug,
          sortOrder: j,
        },
      });
      categoryIds.set(child.slug, c.id);
    }
  }

  // --- Colors & sizes ------------------------------------------------------
  const colorSpec = [
    { name: "Indigo", hex: "#2B3A67" },
    { name: "Ivory", hex: "#F3EDE1" },
    { name: "Terracotta", hex: "#B4552F" },
    { name: "Charcoal", hex: "#2E2C2A" },
    { name: "Olive", hex: "#5E6B45" },
    { name: "Brass", hex: "#B8873B" },
  ];

  const colorIds = new Map<string, number>();
  for (const [i, c] of colorSpec.entries()) {
    const row = await prisma.color.upsert({
      where: { storeId_name: { storeId: store.id, name: c.name } },
      update: {},
      create: { storeId: store.id, name: c.name, hex: c.hex, sortOrder: i },
    });
    colorIds.set(c.name, row.id);
  }

  for (const [i, name] of ["XS", "S", "M", "L", "XL", "XXL"].entries()) {
    await prisma.size.upsert({
      where: { storeId_name: { storeId: store.id, name } },
      update: {},
      create: { storeId: store.id, name, sortOrder: i },
    });
  }

  // --- Products ------------------------------------------------------------
  type ProductSpec = {
    name: string;
    slug: string;
    category: string;
    price: number;
    salePrice?: number;
    short: string;
    description: string;
    photos: string[];
    colors: string[];
    sizes: string[];
    featured?: boolean;
    isNew?: boolean;
    stock?: number;
  };

  const products: ProductSpec[] = [
    {
      name: "Jamdani Handloom Saree",
      slug: "jamdani-handloom-saree",
      category: "sarees",
      price: 12500,
      salePrice: 9800,
      short: "Hand-woven Jamdani in undyed cotton with a brass motif border.",
      description:
        "Woven on a pit loom in Rupganj over six weeks, this Jamdani carries the discontinuous supplementary weft that gives the cloth its floating motifs. Each piece is unrepeatable — small irregularities are the signature of the hand, not a flaw.",
      photos: ["photo-1610030469983-98e550d6193c", "photo-1600185365483-26d7a4cc7519"],
      colors: ["Ivory", "Indigo"],
      sizes: ["S", "M", "L"],
      featured: true,
      isNew: true,
      stock: 14,
    },
    {
      name: "Indigo Block-Print Kurti",
      slug: "indigo-block-print-kurti",
      category: "kurtis",
      price: 3200,
      short: "Natural indigo, hand blocks, soft-washed cotton.",
      description:
        "Dyed in small batches with fermented natural indigo and stamped with hand-carved teak blocks. The colour deepens for the first few washes and then settles — no two runs match exactly.",
      photos: ["photo-1595777457583-95e059d581b8", "photo-1618244972963-dbee1a7edc95"],
      colors: ["Indigo", "Ivory"],
      sizes: ["XS", "S", "M", "L", "XL"],
      featured: true,
      stock: 48,
    },
    {
      name: "Embroidered Salwar Kameez Set",
      slug: "embroidered-salwar-kameez-set",
      category: "salwar-kameez",
      price: 7400,
      salePrice: 5900,
      short: "Three-piece set with chikankari at the yoke.",
      description:
        "A full three-piece — kameez, salwar and dupatta — in a breathable cotton-silk blend, with chikankari shadow-work across the yoke and cuffs.",
      photos: ["photo-1594633312681-425c7b97ccd1", "photo-1618244972963-dbee1a7edc95"],
      colors: ["Terracotta", "Olive"],
      sizes: ["S", "M", "L", "XL"],
      stock: 26,
    },
    {
      name: "Classic Cotton Panjabi",
      slug: "classic-cotton-panjabi",
      category: "panjabi",
      price: 4200,
      short: "Full-sleeve panjabi in slub cotton with a placket in matching thread.",
      description:
        "Cut long and easy through the body, in a slub cotton that softens with wear. Mother-of-pearl buttons and a hand-finished placket.",
      photos: ["photo-1602810318383-e386cc2a3ccf", "photo-1622470953794-aa9c70b0fb9d"],
      colors: ["Ivory", "Charcoal", "Olive"],
      sizes: ["S", "M", "L", "XL", "XXL"],
      featured: true,
      stock: 62,
    },
    {
      name: "Muslin Festive Panjabi",
      slug: "muslin-festive-panjabi",
      category: "panjabi",
      price: 8900,
      short: "Fine muslin with tonal karchupi at the collar and cuffs.",
      description:
        "For Eid and weddings. Woven in fine muslin and finished with tonal karchupi embroidery so it reads as texture rather than ornament.",
      photos: ["photo-1621072156002-e2fccdc0b176", "photo-1594938298603-c8148c4dae35"],
      colors: ["Ivory", "Brass"],
      sizes: ["M", "L", "XL"],
      isNew: true,
      stock: 18,
    },
    {
      name: "Oxford Button-Down Shirt",
      slug: "oxford-button-down-shirt",
      category: "shirts",
      price: 2900,
      salePrice: 2200,
      short: "Everyday oxford with a soft-roll collar.",
      description:
        "A weekday staple in mid-weight oxford cotton, cut with a soft-roll collar and a slightly relaxed body.",
      photos: ["photo-1596755094514-f87e34085b2c", "photo-1603252109303-2751441dd157"],
      colors: ["Ivory", "Indigo"],
      sizes: ["S", "M", "L", "XL"],
      stock: 74,
    },
    {
      name: "Heavyweight Cotton Tee",
      slug: "heavyweight-cotton-tee",
      category: "t-shirts",
      price: 1400,
      short: "240gsm combed cotton, boxy fit.",
      description:
        "Knitted from 240gsm combed cotton with a ribbed collar that keeps its shape. Boxy through the body with a slightly dropped shoulder.",
      photos: ["photo-1521572163474-6864f9cf17ab", "photo-1583743814966-8936f5b7be1a"],
      colors: ["Charcoal", "Ivory", "Olive"],
      sizes: ["S", "M", "L", "XL", "XXL"],
      stock: 120,
    },
    {
      name: "Girls' Embroidered Frock",
      slug: "girls-embroidered-frock",
      category: "girls",
      price: 2400,
      short: "Lined cotton frock with scalloped hem.",
      description:
        "Fully lined so it sits well and doesn't itch, with a scalloped hem and covered buttons down the back.",
      photos: ["photo-1518831959646-742c3a14ebf7", "photo-1471286174890-9c112ffca5b4"],
      colors: ["Terracotta", "Ivory"],
      sizes: ["XS", "S", "M"],
      isNew: true,
      stock: 33,
    },
    {
      name: "Boys' Cotton Kurta Set",
      slug: "boys-cotton-kurta-set",
      category: "boys",
      price: 2800,
      salePrice: 2100,
      short: "Kurta and pyjama in easy-wash cotton.",
      description:
        "A two-piece kurta and pyjama in a cotton that survives the wash cycle. Elasticated waist, no drawstring to lose.",
      photos: ["photo-1503944583220-79d8926ad5e2", "photo-1622290291468-a28f7a7dc6a8"],
      colors: ["Indigo", "Ivory"],
      sizes: ["XS", "S", "M"],
      stock: 41,
    },
    {
      name: "Silk-Blend Dupatta",
      slug: "silk-blend-dupatta",
      category: "sarees",
      price: 1900,
      short: "Lightweight silk-blend with a hand-knotted fringe.",
      description:
        "A silk-cotton blend that drapes without slipping, finished with a hand-knotted fringe at both ends.",
      photos: ["photo-1600185365483-26d7a4cc7519", "photo-1611652022419-a9419f74343d"],
      colors: ["Brass", "Terracotta", "Indigo"],
      sizes: ["M"],
      stock: 57,
    },
    {
      name: "Linen Blend Shirt",
      slug: "linen-blend-shirt",
      category: "shirts",
      price: 3600,
      short: "Half-placket linen shirt for Dhaka summers.",
      description:
        "A 55/45 linen-cotton blend that breathes through the humidity, cut with a half placket and a camp collar.",
      photos: ["photo-1594938298603-c8148c4dae35", "photo-1602810318383-e386cc2a3ccf"],
      colors: ["Ivory", "Olive"],
      sizes: ["S", "M", "L", "XL"],
      featured: true,
      stock: 39,
    },
    {
      name: "Handwoven Cotton Saree",
      slug: "handwoven-cotton-saree",
      category: "sarees",
      price: 5600,
      short: "Everyday handloom with a contrast border.",
      description:
        "A daily-wear handloom cotton that only gets softer. Contrast border woven in, not stitched on.",
      photos: ["photo-1611652022419-a9419f74343d", "photo-1610030469983-98e550d6193c"],
      colors: ["Olive", "Terracotta", "Indigo"],
      sizes: ["M"],
      stock: 29,
    },
  ];

  for (const spec of products) {
    const categoryId = categoryIds.get(spec.category);
    if (!categoryId) throw new Error(`Unknown category ${spec.category}`);

    const existing = await prisma.product.findFirst({
      where: { storeId: store.id, slug: spec.slug },
    });
    if (existing) continue;

    await prisma.product.create({
      data: {
        storeId: store.id,
        categoryId,
        name: spec.name,
        slug: spec.slug,
        shortDescription: spec.short,
        description: spec.description,
        price: spec.price,
        salePrice: spec.salePrice ?? null,
        costPrice: Math.round(spec.price * 0.55),
        sku: spec.slug.toUpperCase().slice(0, 20),
        barcode: `88${Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)}`,
        stockQuantity: spec.stock ?? 25,
        isFeatured: spec.featured ?? false,
        isNew: spec.isNew ?? false,
        status: "ACTIVE",
        images: {
          create: spec.photos.map((id, i) => ({
            path: PHOTO(id),
            altText: spec.name,
            isPrimary: i === 0,
            sortOrder: i,
          })),
        },
        variants: {
          create: spec.sizes.flatMap((size) =>
            spec.colors.map((color) => ({
              size,
              colorName: color,
              colorHex: colorSpec.find((c) => c.name === color)?.hex,
              colorId: colorIds.get(color),
              sku: `${spec.slug.toUpperCase().slice(0, 12)}-${size}-${color.slice(0, 3).toUpperCase()}`,
              // Larger sizes carry a small surcharge, as in the legacy data.
              priceModifier: size === "XXL" ? 200 : size === "XL" ? 100 : 0,
              stockQuantity: Math.floor(Math.random() * 12) + 2,
            })),
          ),
        },
      },
    });
  }

  // --- Sliders -------------------------------------------------------------
  const sliders = [
    {
      title: "Authenticity in Every Stitch",
      subtitle: "The Handloom Edit",
      description:
        "Jamdani, muslin and khadi from weavers we buy from directly — no middlemen, no mystery about who made it.",
      buttonText: "Shop the edit",
      buttonLink: "/shop",
      button2Text: "Our weavers",
      button2Link: "/shop?sort=popular",
      image: PHOTO("photo-1610030469983-98e550d6193c"),
    },
    {
      title: "Dyed in Bengal Indigo",
      subtitle: "New Season",
      description: "Small-batch natural indigo. It fades the way it is supposed to.",
      buttonText: "Shop indigo",
      buttonLink: "/shop?sort=newest",
      image: PHOTO("photo-1595777457583-95e059d581b8"),
    },
    {
      title: "Made for the Humidity",
      subtitle: "Summer Weights",
      description: "Linen, muslin and open-weave cotton for months that do not let up.",
      buttonText: "Shop summer",
      buttonLink: "/shop",
      image: PHOTO("photo-1594938298603-c8148c4dae35"),
    },
  ];

  if ((await prisma.slider.count()) === 0) {
    for (const [i, s] of sliders.entries()) {
      await prisma.slider.create({
        data: { storeId: store.id, ...s, sortOrder: i, textPosition: i === 1 ? "CENTER" : "LEFT" },
      });
    }
  }

  // --- Lookbook ------------------------------------------------------------
  const lookbook = [
    { image: PHOTO("photo-1483985988355-763728e1935b"), caption: "The Saree Edit", link: "/shop/category/sarees", isFeatured: true },
    { image: PHOTO("photo-1602810318383-e386cc2a3ccf"), caption: "Panjabi, everyday", link: "/shop/category/panjabi" },
    { image: PHOTO("photo-1595777457583-95e059d581b8"), caption: "Indigo studies", link: "/shop/category/kurtis" },
    { image: PHOTO("photo-1519238263530-99bdd11df2ea"), caption: "Small people, good cloth", link: "/shop/category/children" },
    { image: PHOTO("photo-1596755094514-f87e34085b2c"), caption: "Shirting", link: "/shop/category/shirts" },
  ];

  if ((await prisma.lookbookItem.count()) === 0) {
    for (const [i, l] of lookbook.entries()) {
      await prisma.lookbookItem.create({ data: { storeId: store.id, ...l, sortOrder: i } });
    }
  }

  // --- Social links --------------------------------------------------------
  const socials = [
    { platform: "facebook", name: "Facebook", url: "https://facebook.com/waslah", icon: "facebook", color: "#1877F2" },
    { platform: "instagram", name: "Instagram", url: "https://instagram.com/waslah", icon: "instagram", color: "#E4405F", showInHeader: true },
    { platform: "whatsapp", name: "WhatsApp", url: "https://wa.me/8801700000000", icon: "whatsapp", color: "#25D366", showInHeader: true },
    { platform: "youtube", name: "YouTube", url: "https://youtube.com/@waslah", icon: "youtube", color: "#FF0000" },
  ];

  if ((await prisma.socialLink.count()) === 0) {
    for (const [i, s] of socials.entries()) {
      await prisma.socialLink.create({ data: { storeId: store.id, ...s, sortOrder: i } });
    }
  }

  // --- Couriers ------------------------------------------------------------
  const couriers = [
    { name: "Pathao Courier", code: "pathao", baseRate: 80, estimatedDays: "1-3", description: "Nationwide, with live tracking." },
    { name: "Steadfast", code: "steadfast", baseRate: 70, estimatedDays: "2-4", description: "Economy nationwide delivery." },
    { name: "Store Pickup", code: "pickup", baseRate: 0, estimatedDays: "0", description: "Collect from our Gulshan store." },
  ];

  for (const c of couriers) {
    await prisma.courier.upsert({
      where: { storeId_code: { storeId: store.id, code: c.code } },
      update: {},
      create: { storeId: store.id, ...c },
    });
  }

  // --- Coupons -------------------------------------------------------------
  const coupons = [
    { code: "WELCOME10", type: "PERCENTAGE" as const, value: 10, minimumAmount: 2000, maximumDiscount: 1500 },
    { code: "FLAT500", type: "FIXED" as const, value: 500, minimumAmount: 3000 },
    { code: "FREESHIP", type: "FREE_SHIPPING" as const, value: 0, minimumAmount: 1500 },
  ];

  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { storeId_code: { storeId: store.id, code: c.code } },
      update: {},
      create: { storeId: store.id, ...c },
    });
  }

  // --- Business settings ---------------------------------------------------
  const settings: { key: string; value: string; group: string }[] = [
    { key: "business_phone", value: "+880 1700 000000", group: "contact" },
    { key: "business_email", value: "info@waslah.com", group: "contact" },
    { key: "business_address", value: "Gulshan Avenue, Dhaka 1212, Bangladesh", group: "contact" },
    { key: "business_hours", value: "Sat–Thu, 10:00–20:00", group: "contact" },
    { key: "free_shipping_threshold", value: "5000", group: "shipping" },
    { key: "default_shipping_cost", value: "80", group: "shipping" },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { storeId_key: { storeId: store.id, key: s.key } },
      update: {},
      create: { storeId: store.id, ...s },
    });
  }

  const counts = {
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    categories: await prisma.category.count(),
    sliders: await prisma.slider.count(),
    coupons: await prisma.coupon.count(),
  };

  console.log("Seed complete:", counts);
  console.log("  admin@waslah.com / admin1234");
  console.log("  manager@waslah.com / manager1234");
  console.log("  customer@waslah.com / customer1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
