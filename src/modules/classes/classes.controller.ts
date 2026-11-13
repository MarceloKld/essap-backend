import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ClassesService } from './classes.service.js';

@ApiTags('Classes')
@ApiBearerAuth()
@Roles('DG', 'SGAC', 'ADMIN_BUDGET')
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des classes actives (L1, L2, L3...)' })
  lister() {
    return this.classes.lister();
  }
}