import fs from 'fs';
import path from 'path';
import multer from 'multer';

import { ApiError } from '../utils/apiResponse.js';

const avatarDirectory = path.join(process.cwd(), 'uploads', 'avatars');

fs.mkdirSync(avatarDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const userId = req.user?._id?.toString() || 'user';

    cb(null, `${userId}-${Date.now()}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.mimetype)) {
    cb(
      new ApiError({
        statusCode: 400,
        message: 'Only JPG, PNG, and WebP images are allowed.'
      })
    );

    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

export { upload };