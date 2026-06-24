import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as storefrontApi from "../api/storefront";

const ROTATE_INTERVAL_MS = 5000;

export function BannerCarousel() {
  const { data } = useQuery({ queryKey: ["banners"], queryFn: storefrontApi.listBanners });
  const banners = data?.banners ?? [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[index % banners.length];
  const image = (
    <img src={banner.imageUrl} alt="" className="h-40 w-full rounded-xl object-cover sm:h-56" />
  );

  return (
    <div className="mb-6">
      {banner.linkUrl ? (
        <a href={banner.linkUrl} target="_blank" rel="noreferrer">
          {image}
        </a>
      ) : (
        image
      )}
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setIndex(i)}
              aria-label={`Banner ${i + 1}`}
              className={`h-1.5 w-1.5 rounded-full ${i === index % banners.length ? "bg-clay-600" : "bg-clay-200"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
