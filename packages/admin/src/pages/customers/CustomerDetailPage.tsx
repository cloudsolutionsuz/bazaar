import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import * as customersApi from "../../api/customers";
import { Badge } from "../../components/ui/Badge";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";
import { STATUS_COLORS, STATUS_LABEL_KEYS } from "../orders/OrdersListPage";
import { regionName, districtName } from "../../utils/addressLabels";

export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.getCustomer(id as string),
  });

  const customer = query.data?.customer;
  if (!customer) return null;

  return (
    <div className="max-w-4xl">
      <Link to="/customers" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
        <p className="text-sm text-gray-500">{customer.phone}</p>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-500">{t("customers.balance")}</div>
            <div className="text-xl font-semibold text-gray-900">{customer.totalSpent.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t("customers.orderCount")}</div>
            <div className="text-xl font-semibold text-gray-900">{customer.orderCount}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">{t("customers.customerSince")}</div>
            <div className="text-xl font-semibold text-gray-900">{new Date(customer.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("customers.purchases")}</h2>
      <Table>
        <Thead>
          <tr>
            <Th>{t("orders.date")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("orders.region")}</Th>
            <Th>{t("orders.district")}</Th>
            <Th>{t("orders.mahalla")}</Th>
            <Th>{t("orders.total")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {customer.orders.map((o) => (
            <tr key={o.id}>
              <Td>{new Date(o.createdAt).toLocaleString()}</Td>
              <Td>
                <Badge color={STATUS_COLORS[o.status]}>{t(STATUS_LABEL_KEYS[o.status])}</Badge>
              </Td>
              <Td>{regionName(o.addressRegion)}</Td>
              <Td>{districtName(o.addressRegion, o.addressDistrict)}</Td>
              <Td>{o.addressMahalla ?? "—"}</Td>
              <Td>{o.totalAmount.toLocaleString()}</Td>
              <Td>
                <Link to={`/orders/${o.id}`} className="text-brand-600 hover:underline">
                  {t("common.edit")}
                </Link>
              </Td>
            </tr>
          ))}
          {customer.orders.length === 0 && (
            <tr>
              <Td colSpan={7} className="text-center text-gray-400">
                {t("common.noData")}
              </Td>
            </tr>
          )}
        </Tbody>
      </Table>
    </div>
  );
}
