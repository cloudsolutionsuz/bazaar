import { prisma } from "../../db/prisma";

export async function listVideoBanners() {
  return prisma.videoBanner.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
}

export async function listActiveVideoBanners() {
  return prisma.videoBanner.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, videoUrl: true, position: true },
  });
}

export async function createVideoBanner(data: { title: string; videoUrl: string; position?: number; isActive?: boolean }) {
  return prisma.videoBanner.create({ data });
}

export async function updateVideoBanner(
  id: string,
  data: { title?: string; videoUrl?: string; position?: number; isActive?: boolean },
) {
  return prisma.videoBanner.update({ where: { id }, data });
}

export async function deleteVideoBanner(id: string) {
  return prisma.videoBanner.delete({ where: { id } });
}
