import { Module } from '@nestjs/common';
import { InstitutsController } from './instituts.controller.js';
import { InstitutsService } from './instituts.service.js';

@Module({
  controllers: [InstitutsController],
  providers: [InstitutsService],
})
export class InstitutsModule {}