import { prisma } from "../../db/prisma";
import { AppError } from "../../middleware/errorHandler";
import { slugify } from "../../utils/slugify";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema";

export function listCategories(tenantId: string) {
  return prisma.category.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
}

export async function createCategory(tenantId: string, input: CreateCategoryInput) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  if (!slug) {
    throw new AppError(400, "INVALID_SLUG", "Could not derive a valid slug from the given name");
  }

  const existing = await prisma.category.findUnique({ where: { tenantId_slug: { tenantId, slug } } });
  if (existing) {
    throw new AppError(409, "SLUG_TAKEN", "A category with this slug already exists");
  }

  return prisma.category.create({ data: { tenantId, name: input.name, slug } });
}

async function getOwnedCategory(tenantId: string, categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
  if (!category) {
    throw new AppError(404, "NOT_FOUND", "Category not found");
  }
  return category;
}

export async function updateCategory(tenantId: string, categoryId: string, input: UpdateCategoryInput) {
  await getOwnedCategory(tenantId, categoryId);

  const data: { name?: string; slug?: string } = {};
  if (input.name) data.name = input.name;
  if (input.slug || input.name) {
    const slug = slugify(input.slug ?? input.name ?? "");
    if (!slug) {
      throw new AppError(400, "INVALID_SLUG", "Could not derive a valid slug");
    }
    const existing = await prisma.category.findUnique({ where: { tenantId_slug: { tenantId, slug } } });
    if (existing && existing.id !== categoryId) {
      throw new AppError(409, "SLUG_TAKEN", "A category with this slug already exists");
    }
    data.slug = slug;
  }

  return prisma.category.update({ where: { id: categoryId }, data });
}

export async function deleteCategory(tenantId: string, categoryId: string): Promise<void> {
  await getOwnedCategory(tenantId, categoryId);

  const productCount = await prisma.product.count({ where: { tenantId, categoryId } });
  if (productCount > 0) {
    throw new AppError(409, "CATEGORY_IN_USE", "Cannot delete a category that still has products");
  }

  await prisma.category.delete({ where: { id: categoryId } });
}
