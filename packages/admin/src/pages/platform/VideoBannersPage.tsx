import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../api/videoBanners";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";

function getEmbedUrl(url: string): string | null {
  // YouTube watch or short link
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  // Already an embed URL or direct video
  return url;
}

function VideoPreview({ url }: { url: string }) {
  const embed = getEmbedUrl(url);
  if (!embed) return null;
  const isDirect = /\.(mp4|webm|ogg)(\?|$)/i.test(embed);
  if (isDirect) {
    return (
      <video src={embed} controls className="h-28 w-48 rounded object-cover" />
    );
  }
  return (
    <iframe
      src={embed}
      className="h-28 w-48 rounded"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

export function VideoBannersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [position, setPosition] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editPos, setEditPos] = useState(0);

  const query = useQuery({ queryKey: ["video-banners", "all"], queryFn: api.listAll });
  const items = query.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () => api.create({ title, videoUrl, position }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-banners"] });
      setTitle("");
      setVideoUrl("");
      setPosition(0);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.update(editId!, { title: editTitle, videoUrl: editUrl, position: editPos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-banners"] });
      setEditId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-banners"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-banners"] }),
  });

  function startEdit(item: api.VideoBanner) {
    setEditId(item.id);
    setEditTitle(item.title);
    setEditUrl(item.videoUrl);
    setEditPos(item.position);
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{t("nav.videoBanners")}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Add form */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-base font-semibold text-gray-700 dark:text-gray-300">Добавить видео</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Название</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Обзор платформы Bazaar"
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">
                Ссылка на видео (YouTube / Vimeo / прямая)
              </label>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Порядок (меньше = первее)</label>
              <Input
                type="number"
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
                className="w-full"
              />
            </div>
            {videoUrl && (
              <div>
                <p className="mb-1 text-xs text-gray-500">Предпросмотр</p>
                <VideoPreview url={videoUrl} />
              </div>
            )}
            <Button
              className="w-full"
              disabled={!title || !videoUrl || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Добавление..." : "Добавить"}
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <Table>
            <Thead>
              <tr>
                <Th>Предпросмотр</Th>
                <Th>Название</Th>
                <Th>Порядок</Th>
                <Th>Статус</Th>
                <Th>Действия</Th>
              </tr>
            </Thead>
            <Tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <Td>
                    {editId === item.id ? null : <VideoPreview url={item.videoUrl} />}
                  </Td>
                  <Td>
                    {editId === item.id ? (
                      <div className="space-y-1">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full"
                          placeholder="Название"
                        />
                        <Input
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="w-full"
                          placeholder="URL"
                        />
                        <Input
                          type="number"
                          value={editPos}
                          onChange={(e) => setEditPos(Number(e.target.value))}
                          className="w-20"
                          placeholder="Порядок"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{item.title}</div>
                        <div className="mt-0.5 max-w-xs truncate text-xs text-gray-400">{item.videoUrl}</div>
                      </div>
                    )}
                  </Td>
                  <Td>{item.position}</Td>
                  <Td>
                    <Badge color={item.isActive ? "green" : "gray"}>
                      {item.isActive ? "Активен" : "Скрыт"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {editId === item.id ? (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => updateMutation.mutate()}
                            disabled={updateMutation.isPending}
                          >
                            Сохранить
                          </Button>
                          <Button variant="ghost" onClick={() => setEditId(null)}>
                            Отмена
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="secondary" onClick={() => startEdit(item)}>
                            Изменить
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                          >
                            {item.isActive ? "Скрыть" : "Показать"}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => {
                              if (window.confirm(`Удалить «${item.title}»?`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                          >
                            Удалить
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <Td colSpan={5} className="text-center text-gray-400">
                    Нет видео. Добавьте первое.
                  </Td>
                </tr>
              )}
            </Tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}
