import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Global() // disponible dans tous les modules sans réimporter
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}