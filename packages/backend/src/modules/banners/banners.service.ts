import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { deleteStoredImage } from "../../utils/imageStorage";
import type { UpdateBannerInput } from "./banners.schema";

export function listBanners(tenantId: string) {
  return prisma.banner.findMany({ where: { tenantId }, orderBy: { position: "asc" } });
}

export function listActiveBanners(tenantId: string) {
  return prisma.banner.findMany({ where: { tenantId, isActive: true }, orderBy: { position: "asc" } });
}

export async function createBanner(tenantId: string, imageUrl: string, linkUrl?: string) {
  const count = await prisma.banner.count({ where: { tenantId } });
  return prisma.banner.create({ data: { tenantId, imageUrl, linkUrl, position: count } });
}

async function getBannerOrThrow(tenantId: string, bannerId: string) {
  const banner = await prisma.banner.findFirst({ where: { id: bannerId, tenantId } });
  if (!banner) {
    throw new AppError(404, "NOT_FOUND", "Banner not found");
  }
  return banner;
}

export async function updateBanner(tenantId: string, bannerId: string, input: UpdateBannerInput) {
  await getBannerOrThrow(tenantId, bannerId);
  return prisma.banner.update({ where: { id: bannerId }, data: input });
}

export async function deleteBanner(tenantId: string, bannerId: string): Promise<void> {
  const banner = await getBannerOrThrow(tenantId, bannerId);
  await prisma.banner.delete({ where: { id: bannerId } });
  await deleteStoredImage(banner.imageUrl);
}

export async function reorderBanners(tenantId: string, bannerIds: string[]): Promise<void> {
  const banners = await listBanners(tenantId);
  const existingIds = new Set(banners.map((b) => b.id));

  if (bannerIds.length !== existingIds.size || !bannerIds.every((id) => existingIds.has(id))) {
    throw new AppError(400, "INVALID_BANNER_SET", "bannerIds must match the tenant's existing banners exactly");
  }

  await prisma.$transaction(bannerIds.map((id, position) => prisma.banner.update({ where: { id }, data: { position } })));
}
