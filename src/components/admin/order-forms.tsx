"use client";

import { useActionState } from "react";

import {
  appendOrderNote,
  updateOrderPaymentStatus,
  updateOrderShipment,
  updateOrderStatus,
} from "@/actions/admin/orders";
import { initialFormState } from "@/actions/types";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";

const ORDER_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled — restores stock" },
  { value: "REFUNDED", label: "Refunded — restores stock" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Awaiting payment" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const SHIPMENT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "PICKED_UP", label: "Picked up" },
  { value: "IN_TRANSIT", label: "In transit" },
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "FAILED", label: "Failed" },
];

export function OrderStatusForm({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: number;
  status: string;
  paymentStatus: string;
}) {
  const [statusState, statusAction] = useActionState(
    updateOrderStatus.bind(null, orderId),
    initialFormState,
  );
  const [paymentState, paymentAction] = useActionState(
    updateOrderPaymentStatus.bind(null, orderId),
    initialFormState,
  );

  return (
    <Panel title="Status">
      <div className="space-y-5 p-5">
        <form action={statusAction} className="space-y-3">
          <SelectField
            name="status"
            label="Order status"
            defaultValue={status}
            errors={statusState.errors?.status}
            options={ORDER_STATUS_OPTIONS}
            hint="Cancelling or refunding returns unsold stock to inventory once."
          />
          <FormMessage state={statusState} />
          <SubmitButton className="w-full">Update order status</SubmitButton>
        </form>

        <form action={paymentAction} className="space-y-3 border-t border-border pt-5">
          <SelectField
            name="paymentStatus"
            label="Payment status"
            defaultValue={paymentStatus}
            errors={paymentState.errors?.paymentStatus}
            options={PAYMENT_STATUS_OPTIONS}
          />
          <FormMessage state={paymentState} />
          <SubmitButton className="w-full" variant="outline">
            Update payment status
          </SubmitButton>
        </form>
      </div>
    </Panel>
  );
}

export function OrderShipmentForm({
  orderId,
  couriers,
  shipment,
}: {
  orderId: number;
  couriers: { id: number; name: string }[];
  shipment: {
    courierId: number | null;
    trackingNumber: string | null;
    status: string;
  } | null;
}) {
  const [state, action] = useActionState(
    updateOrderShipment.bind(null, orderId),
    initialFormState,
  );
  const e = state.errors ?? {};

  return (
    <Panel
      title="Shipping"
      description={shipment ? undefined : "No shipment recorded yet."}
    >
      <form action={action} className="space-y-4 p-5">
        <SelectField
          name="courierId"
          label="Courier"
          placeholder="Not assigned"
          defaultValue={shipment?.courierId ?? ""}
          errors={e.courierId}
          options={couriers.map((c) => ({ value: c.id, label: c.name }))}
        />
        <TextField
          name="trackingNumber"
          label="Tracking number"
          maxLength={100}
          defaultValue={shipment?.trackingNumber ?? ""}
          errors={e.trackingNumber}
        />
        <SelectField
          name="status"
          label="Shipment status"
          defaultValue={shipment?.status ?? "PENDING"}
          errors={e.status}
          options={SHIPMENT_STATUS_OPTIONS}
        />
        <TextField
          name="note"
          label="Tracking note"
          maxLength={255}
          placeholder="Optional — added to the timeline"
          errors={e.note}
        />
        <FormMessage state={state} />
        <SubmitButton className="w-full">
          {shipment ? "Update shipping" : "Create shipment"}
        </SubmitButton>
      </form>
    </Panel>
  );
}

export function OrderNoteForm({ orderId }: { orderId: number }) {
  const [state, action] = useActionState(
    appendOrderNote.bind(null, orderId),
    initialFormState,
  );

  return (
    <form action={action} className="space-y-3 border-t border-border p-5">
      <TextareaField
        name="note"
        label="Add an internal note"
        rows={3}
        maxLength={2000}
        required
        errors={state.errors?.note}
        hint="Stamped with your name and appended to the trail — nothing is overwritten."
      />
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton>Add note</SubmitButton>
      </div>
    </form>
  );
}
