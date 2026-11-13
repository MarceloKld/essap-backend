import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service.js';
import { ImageService } from './image.service.js';

@Module({
  providers: [ImageService, CloudinaryService],
  exports: [ImageService, CloudinaryService],
})
export class MediasModule {}