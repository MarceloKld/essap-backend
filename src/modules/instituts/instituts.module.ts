import { Module } from '@nestjs/common';
import { MediasModule } from '../medias/medias.module.js';
import { InstitutsController } from './instituts.controller.js';
import { InstitutsService } from './instituts.service.js';
import { LogoService } from './logo.service.js';

@Module({
  imports: [MediasModule],
  controllers: [InstitutsController],
  providers: [InstitutsService, LogoService],
})
export class InstitutsModule {}