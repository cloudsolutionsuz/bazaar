import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as reviewsApi from "../../api/reviews";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";

const STARS = [1, 2, 3, 4, 5];

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

type FilterTab = "pending" | "approved" | "all";

export function ReviewsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FilterTab>("pending");

  const approved = tab === "pending" ? false : tab === "approved" ? true : undefined;

  const reviewsQuery = useQuery({
    queryKey: ["reviews", tab],
    queryFn: () => reviewsApi.listReviews({ approved }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["reviews"] });
  }

  const approveMutation = useMutation({ mutationFn: reviewsApi.approveReview, onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: reviewsApi.deleteReview, onSuccess: invalidate });

  const items = reviewsQuery.data?.items ?? [];

  const tabClass = (t: FilterTab) =>
    `px-4 py-2 text-sm font-medium rounded-t-md border-b-2 ${
      tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">{t("reviews.title")}</h1>

      <div className="mb-4 flex gap-2 border-b border-gray-200">
        <button className={tabClass("pending")} onClick={() => setTab("pending")}>
          {t("reviews.tabPending")}
        </button>
        <button className={tabClass("approved")} onClick={() => setTab("approved")}>
          {t("reviews.tabApproved")}
        </button>
        <button className={tabClass("all")} onClick={() => setTab("all")}>
          {t("reviews.tabAll")}
        </button>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("reviews.product")}</Th>
            <Th>{t("reviews.customer")}</Th>
            <Th>{t("reviews.rating")}</Th>
            <Th>{t("reviews.comment")}</Th>
            <Th>{t("reviews.status")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {items.length === 0 && (
            <tr>
              <Td colSpan={6} className="text-center text-gray-500">
                {t("reviews.empty")}
              </Td>
            </tr>
          )}
          {items.map((review) => (
            <tr key={review.id}>
              <Td className="max-w-[160px] truncate font-medium">{review.product.name}</Td>
              <Td>
                <div className="text-sm">{review.customerName}</div>
                <div className="text-xs text-gray-400">{review.customerPhone}</div>
              </Td>
              <Td>
                <StarDisplay rating={review.rating} />
              </Td>
              <Td className="max-w-[240px]">
                <p className="line-clamp-2 text-sm text-gray-700">{review.text || "—"}</p>
              </Td>
              <Td>
                <Badge color={review.isApproved ? "green" : "yellow"}>
                  {review.isApproved ? t("reviews.approved") : t("reviews.pending")}
                </Badge>
              </Td>
              <Td>
                <div className="flex gap-2">
                  {!review.isApproved && (
                    <Button
                      variant="secondary"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(review.id)}
                    >
                      {t("reviews.approve")}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(t("reviews.confirmDelete"))) {
                        deleteMutation.mutate(review.id);
                      }
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
