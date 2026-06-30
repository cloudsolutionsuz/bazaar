import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as customersApi from "../../api/customers";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { downloadBlob } from "../../utils/downloadBlob";
import { regionName, districtName } from "../../utils/addressLabels";

export function CustomersListPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ["customers", { search: debouncedSearch, page }],
    queryFn: () => customersApi.list({ search: debouncedSearch || undefined, page, pageSize: 20 }),
  });

  const customers = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleExport() {
    const blob = await customersApi.exportCustomers();
    downloadBlob(blob, "customers.xlsx");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("customers.title")}</h1>
        <Button variant="secondary" onClick={handleExport}>
          {t("common.export")}
        </Button>
      </div>

      <div className="mb-4">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("customers.searchPlaceholder")}
          className="w-full max-w-sm"
        />
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>{t("customers.name")}</Th>
            <Th>{t("customers.phone")}</Th>
            <Th>{t("orders.region")}</Th>
            <Th>{t("orders.district")}</Th>
            <Th>{t("orders.mahalla")}</Th>
            <Th>{t("customers.orderCount")}</Th>
            <Th>{t("customers.purchaseAmount")}</Th>
            <Th>{t("customers.paidAmount")}</Th>
            <Th>{t("customers.balance")}</Th>
            <Th>{t("customers.lastOrderAt")}</Th>
            <Th>{t("customers.customerSince")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {customers.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link to={`/customers/${c.id}`} className="text-brand-600 hover:underline">
                  {c.name}
                </Link>
              </Td>
              <Td>{c.phone}</Td>
              <Td>{regionName(c.addressRegion)}</Td>
              <Td>{districtName(c.addressRegion, c.addressDistrict)}</Td>
              <Td>{c.addressMahalla ?? "—"}</Td>
              <Td>{c.orderCount}</Td>
              <Td>{c.purchaseAmount.toLocaleString()}</Td>
              <Td>{c.paidAmount.toLocaleString()}</Td>
              <Td className={c.balance > 0 ? "text-red-600" : ""}>{c.balance.toLocaleString()}</Td>
              <Td>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : "—"}</Td>
              <Td>{new Date(c.createdAt).toLocaleDateString()}</Td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <Td colSpan={11} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {t("common.page")} {page} / {totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ←
          </Button>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
