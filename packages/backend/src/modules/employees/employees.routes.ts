import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { validateBody } from "../../middleware/validate";
import { inviteEmployeeSchema, updateEmployeeSchema } from "./employees.schema";
import * as employeesController from "./employees.controller";

export const employeesRouter = Router();

employeesRouter.use(requireAuth(), requireRole("OWNER"));

employeesRouter.get("/", asyncHandler(employeesController.list));
employeesRouter.post("/invite", validateBody(inviteEmployeeSchema), asyncHandler(employeesController.invite));
employeesRouter.patch("/:id", validateBody(updateEmployeeSchema), asyncHandler(employeesController.updateRole));
employeesRouter.delete("/:id", asyncHandler(employeesController.remove));
