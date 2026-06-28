import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as productsApi from "../../api/products";
import { Button } from "../../components/ui/Button";
import type { ProductImage } from "../../types/api";

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 1024 * 1024;

export function ImagesManager({ productId, images }: { productId: string; images: ProductImage[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["product", productId] });
  }

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => productsApi.uploadImages(productId, files),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => productsApi.deleteImage(productId, imageId),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (imageIds: string[]) => productsApi.reorderImages(productId, imageIds),
    onSuccess: invalidate,
  });

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      setSizeError(t("products.imageTooLarge", { name: tooBig.name }));
      e.target.value = "";
      return;
    }
    setSizeError(null);
    if (files.length > 0) uploadMutation.mutate(files);
    e.target.value = "";
  }

  const sorted = [...images].sort((a, b) => a.position - b.position);

  function move(index: number, direction: -1 | 1) {
    const newOrder = [...sorted];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    reorderMutation.mutate(newOrder.map((img) => img.id));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {sorted.map((img, index) => (
          <div key={img.id} className="relative w-28 rounded-md border border-gray-200 p-1">
            <img src={img.url} alt="" className="h-24 w-full rounded object-cover" />
            <div className="mt-1 flex items-center justify-between text-xs">
              <button onClick={() => move(index, -1)} disabled={index === 0} className="disabled:opacity-30">
                ↑
              </button>
              <button onClick={() => move(index, 1)} disabled={index === sorted.length - 1} className="disabled:opacity-30">
                ↓
              </button>
              <button onClick={() => deleteMutation.mutate(img.id)} className="text-red-600">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {sizeError && <p className="mt-2 text-sm text-red-600">{sizeError}</p>}

      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <Button
        type="button"
        variant="secondary"
        className="mt-3"
        disabled={images.length >= MAX_IMAGES}
        onClick={() => fileInputRef.current?.click()}
      >
        {t("products.uploadImages")} ({images.length}/{MAX_IMAGES})
      </Button>
    </div>
  );
}
