import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as bannersApi from "../../api/banners";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import type { Banner } from "../../types/api";

export function BannersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bannersQuery = useQuery({ queryKey: ["banners"], queryFn: bannersApi.listBanners });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["banners"] });
  }

  const createMutation = useMutation({
    mutationFn: ({ file, linkUrl }: { file: File; linkUrl?: string }) => bannersApi.createBanner(file, linkUrl),
    onSuccess: () => {
      invalidate();
      setAdding(false);
      setLinkUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { isActive?: boolean } }) => bannersApi.updateBanner(id, input),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: bannersApi.deleteBanner,
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: bannersApi.reorderBanners,
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    createMutation.mutate({ file, linkUrl: linkUrl || undefined });
  }

  function move(banner: Banner, direction: -1 | 1) {
    const index = banners.findIndex((b) => b.id === banner.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;
    const reordered = [...banners];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    reorderMutation.mutate(reordered.map((b) => b.id));
  }

  const banners = bannersQuery.data?.banners ?? [];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("banners.title")}</h1>
        {!adding && <Button onClick={() => setAdding(true)}>{t("banners.add")}</Button>}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("banners.image")}</label>
            <input ref={fileInputRef} type="file" accept="image/*" required className="block w-full text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t("banners.linkUrl")}</label>
            <Input
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {t("common.save")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {banners.map((banner, index) => (
          <div key={banner.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
            <img src={banner.imageUrl} alt="" className="h-16 w-28 rounded-md object-cover" />
            <div className="flex-1 text-sm">
              <div className="text-gray-700">{banner.linkUrl ?? t("banners.noLink")}</div>
              <Badge color={banner.isActive ? "green" : "gray"}>
                {banner.isActive ? t("banners.active") : t("banners.inactive")}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button variant="secondary" disabled={index === 0} onClick={() => move(banner, -1)}>
                ↑
              </Button>
              <Button variant="secondary" disabled={index === banners.length - 1} onClick={() => move(banner, 1)}>
                ↓
              </Button>
              <Button
                variant="secondary"
                onClick={() => updateMutation.mutate({ id: banner.id, input: { isActive: !banner.isActive } })}
              >
                {banner.isActive ? t("banners.deactivate") : t("banners.activate")}
              </Button>
              <Button variant="danger" onClick={() => deleteMutation.mutate(banner.id)}>
                {t("common.delete")}
              </Button>
            </div>
          </div>
        ))}
        {banners.length === 0 && <p className="text-center text-gray-400">{t("common.noData")}</p>}
      </div>
    </div>
  );
}
