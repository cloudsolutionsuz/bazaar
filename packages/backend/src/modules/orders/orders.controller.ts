import type { Request, Response } from "express";
import type { CreateOrderInput, ListOrdersQuery, UpdateOrderStatusInput } from "./orders.schema";
import * as ordersService from "./orders.service";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await ordersService.listOrders(req.authUser!.tenantId!, req.query as unknown as ListOrdersQuery);
  res.json(result);
}

export async function create(req: Request, res: Response): Promise<void> {
  const order = await ordersService.createOrder(req.authUser!.tenantId!, req.authUser!.id, req.body as CreateOrderInput);
  res.status(201).json({ order });
}

export async function get(req: Request, res: Response): Promise<void> {
  const order = await ordersService.getOrder(req.authUser!.tenantId!, req.params.id);
  res.json({ order });
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { status, courierName } = req.body as UpdateOrderStatusInput;
  const order = await ordersService.updateOrderStatus(req.authUser!.tenantId!, req.authUser!.id, req.params.id, status, courierName);
  res.json({ order });
}

export async function exportOrders(req: Request, res: Response): Promise<void> {
  const buffer = await ordersService.exportOrdersToExcel(req.authUser!.tenantId!);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=orders.xlsx");
  res.send(buffer);
}
