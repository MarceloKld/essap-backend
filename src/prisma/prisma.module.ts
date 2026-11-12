import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global() // disponible partout, sans réimporter le module
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}