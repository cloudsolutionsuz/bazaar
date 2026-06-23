import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { env } from "../src/config/env";

const prisma = new PrismaClient();

const PLANS = [
  {
    code: "start",
    name: "Start",
    priceSum: 200_000,
    maxProducts: 500,
    maxOrdersPerMonth: 100,
    maxEmployees: 1,
    features: { pnl: "basic", support: "ai_chat" },
  },
  {
    code: "business",
    name: "Business",
    priceSum: 450_000,
    maxProducts: 2000,
    maxOrdersPerMonth: 500,
    maxEmployees: 5,
    features: { pnl: "full", support: "ai_chat_priority" },
  },
  {
    code: "pro",
    name: "Pro",
    priceSum: 900_000,
    maxProducts: null,
    maxOrdersPerMonth: null,
    maxEmployees: null,
    features: { pnl: "full_export", support: "personal_manager" },
  },
];

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: env.superadminEmail },
  });

  if (!existingSuperAdmin) {
    const passwordHash = await hashPassword(env.superadminPassword);
    await prisma.user.create({
      data: {
        email: env.superadminEmail,
        passwordHash,
        role: "SUPER_ADMIN",
        name: "Super Admin",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Created super admin: ${env.superadminEmail} / ${env.superadminPassword}`);
  } else {
    console.log("Super admin already exists, skipping.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
