import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { AppError } from "./errorHandler";

function withMulterErrorHandling(middleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err: unknown) => {
      if (err) {
        next(new AppError(400, "UPLOAD_ERROR", err instanceof Error ? err.message : "Upload failed"));
        return;
      }
      next();
    });
  };
}

const imagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
}).array("images", 10);

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("file");

const bannerImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
}).single("image");

export const uploadProductImages = withMulterErrorHandling(imagesUpload);
export const uploadSpreadsheet = withMulterErrorHandling(spreadsheetUpload);
export const uploadBannerImage = withMulterErrorHandling(bannerImageUpload);
