import type { Request, Response } from "express";
import * as bannersService from "./banners.service";
import { saveCompressedImage } from "../../utils/imageStorage";
import { AppError } from "../../middleware/errorHandler";
import type { ReorderBannersInput, UpdateBannerInput } from "./banners.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const banners = await bannersService.listBanners(req.authUser!.tenantId!);
  res.json({ banners });
}

export async function create(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError(400, "NO_FILE", "No image file was uploaded");
  }
  const imageUrl = await saveCompressedImage(file.buffer);
  const linkUrl = (req.body.linkUrl as string | undefined) || undefined;
  const banner = await bannersService.createBanner(req.authUser!.tenantId!, imageUrl, linkUrl);
  res.status(201).json({ banner });
}

export async function update(req: Request, res: Response): Promise<void> {
  const banner = await bannersService.updateBanner(req.authUser!.tenantId!, req.params.id, req.body as UpdateBannerInput);
  res.json({ banner });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await bannersService.deleteBanner(req.authUser!.tenantId!, req.params.id);
  res.status(204).send();
}

export async function reorder(req: Request, res: Response): Promise<void> {
  const { bannerIds } = req.body as ReorderBannersInput;
  await bannersService.reorderBanners(req.authUser!.tenantId!, bannerIds);
  res.status(204).send();
}
