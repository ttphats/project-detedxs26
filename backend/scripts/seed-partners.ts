import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const partners = [
  {
    name: "TechNova Solutions",
    tier: "diamond",
    website: "https://technova.example.com",
    logoUrl: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&h=320&fit=crop",
    sortOrder: 1,
    isActive: true,
    showInMarquee: true
  },
  {
    name: "Global Innovations",
    tier: "diamond",
    website: "https://globalinn.example.com",
    logoUrl: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=320&fit=crop",
    sortOrder: 2,
    isActive: true,
    showInMarquee: true
  },
  {
    name: "Future Finance",
    tier: "diamond",
    website: "https://futurefinance.example.com",
    logoUrl: "https://images.unsplash.com/photo-1556761175-5973dc0f32d7?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1563986768494-4dee2763ff0f?w=800&h=320&fit=crop",
    sortOrder: 3,
    isActive: true,
    showInMarquee: true
  },
  {
    name: "Eco Build",
    tier: "gold",
    website: "https://ecobuild.example.com",
    logoUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=320&fit=crop",
    sortOrder: 4,
    isActive: true,
    showInMarquee: true
  },
  {
    name: "Cloud Sync",
    tier: "gold",
    website: "https://cloudsync.example.com",
    logoUrl: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=320&fit=crop",
    sortOrder: 5,
    isActive: true,
    showInMarquee: true
  },
  {
    name: "Stellar Designs",
    tier: "gold",
    website: "https://stellar.example.com",
    logoUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800&h=320&fit=crop",
    sortOrder: 6,
    isActive: true,
    showInMarquee: true
  },
  {
    name: "Health AI",
    tier: "silver",
    website: "https://healthai.example.com",
    logoUrl: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=800&h=320&fit=crop",
    sortOrder: 7,
    isActive: true,
    showInMarquee: true
  },
  {
    name: "NextGen Auto",
    tier: "silver",
    website: "https://nextgen.example.com",
    logoUrl: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1503376712341-ea1d821361c4?w=800&h=320&fit=crop",
    sortOrder: 8,
    isActive: true,
    showInMarquee: true
  },
  {
    name: "Quantum Logic",
    tier: "silver",
    website: "https://quantum.example.com",
    logoUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=400&h=400&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=320&fit=crop",
    sortOrder: 9,
    isActive: true,
    showInMarquee: true
  }
];

async function seed() {
  console.log("Deleting existing partners...");
  await prisma.partner.deleteMany({});
  
  console.log("Creating 9 new partners...");
  for (const partner of partners) {
    await prisma.partner.create({ data: partner });
  }
  
  console.log("Seed completed successfully!");
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
