import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Les classes sont communes à tous les instituts. M1 et M2 apparaîtront dès qu'on les ajoutera en base. */
  lister() {
    return this.prisma.classe.findMany({
      where: { actif: true },
      orderBy: { ordre: 'asc' },
      select: { id: true, code: true, libelle: true, ordre: true },
    });
  }
}