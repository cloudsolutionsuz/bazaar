import type { Request, Response } from "express";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema";
import * as categoriesService from "./categories.service";

export async function list(req: Request, res: Response): Promise<void> {
  const categories = await categoriesService.listCategories(req.authUser!.tenantId!);
  res.json({ categories });
}

export async function create(req: Request, res: Response): Promise<void> {
  const category = await categoriesService.createCategory(req.authUser!.tenantId!, req.body as CreateCategoryInput);
  res.status(201).json({ category });
}

export async function update(req: Request, res: Response): Promise<void> {
  const category = await categoriesService.updateCategory(
    req.authUser!.tenantId!,
    req.params.id,
    req.body as UpdateCategoryInput,
  );
  res.json({ category });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await categoriesService.deleteCategory(req.authUser!.tenantId!, req.params.id);
  res.status(204).send();
}
