import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Table, Thead, Tbody, Th, Td } from "../../components/ui/Table";

export interface VariantDraft {
  key: string;
  name: string;
  sku: string;
  priceOverride: string;
  stockQuantity: string;
  lowStockThreshold: string;
}

export function emptyVariantDraft(): VariantDraft {
  return { key: crypto.randomUUID(), name: "", sku: "", priceOverride: "", stockQuantity: "0", lowStockThreshold: "" };
}

interface Props {
  drafts: VariantDraft[];
  onChange: (drafts: VariantDraft[]) => void;
}

export function NewVariantsTable({ drafts, onChange }: Props) {
  const { t } = useTranslation();

  function update(key: string, patch: Partial<VariantDraft>) {
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function remove(key: string) {
    onChange(drafts.filter((d) => d.key !== key));
  }

  if (drafts.length === 0) {
    return (
      <Button type="button" variant="secondary" onClick={() => onChange([emptyVariantDraft()])}>
        {t("products.addVariant")}
      </Button>
    );
  }

  return (
    <div>
      <Table>
        <Thead>
          <tr>
            <Th>{t("products.variantName")}</Th>
            <Th>{t("products.sku")}</Th>
            <Th>{t("products.priceOverride")}</Th>
            <Th>{t("products.stock")}</Th>
            <Th>{t("products.lowStockThreshold")}</Th>
            <Th>{t("common.actions")}</Th>
          </tr>
        </Thead>
        <Tbody>
          {drafts.map((d) => (
            <tr key={d.key}>
              <Td>
                <Input value={d.name} onChange={(e) => update(d.key, { name: e.target.value })} />
              </Td>
              <Td>
                <Input required value={d.sku} onChange={(e) => update(d.key, { sku: e.target.value })} />
              </Td>
              <Td>
                <Input type="number" value={d.priceOverride} onChange={(e) => update(d.key, { priceOverride: e.target.value })} />
              </Td>
              <Td>
                <Input type="number" value={d.stockQuantity} onChange={(e) => update(d.key, { stockQuantity: e.target.value })} />
              </Td>
              <Td>
                <Input
                  type="number"
                  value={d.lowStockThreshold}
                  onChange={(e) => update(d.key, { lowStockThreshold: e.target.value })}
                />
              </Td>
              <Td>
                <button type="button" onClick={() => remove(d.key)} className="text-red-600 hover:underline">
                  {t("common.delete")}
                </button>
              </Td>
            </tr>
          ))}
        </Tbody>
      </Table>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => onChange([...drafts, emptyVariantDraft()])}>
        {t("products.addVariant")}
      </Button>
    </div>
  );
}
