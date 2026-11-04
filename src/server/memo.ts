import { CashMemoService } from "./services/cash-memo-service";
// Adapt persisted Phase 3 snapshots to the Phase 2 document renderer, retaining
// its Sanjay Store branding, centered headings, table sizing, and pagination.
type MemoInput = {
  number: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  storeName: string;
  storeContact: string;
  storeLocation?: string;
  totalPaise: number;
  items: {
    name: string;
    hindiName?: string;
    packaging: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }[];
};
const renderer = new CashMemoService();
export async function generateMemo(input: MemoInput) {
  return renderer.generate({
    memoNumber: input.number,
    createdAt: input.createdAt.toISOString(),
    customer: { name: input.customerName, phone: input.customerPhone },
    store: { contact: input.storeContact, location: input.storeLocation || "" },
    totalPaise: input.totalPaise,
    items: input.items.map((item) => {
      const [weight, unit] = item.packaging.split(" ");
      return {
        productId: "",
        name: item.name,
        hindiName: item.hindiName || "",
        weight: Number(weight),
        unit,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        totalPaise: item.lineTotalPaise,
      };
    }),
  });
}
