import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Les classes sont communes à tous les instituts (L1, L2, L3, plus tard M1, M2). */
  lister() {
    return this.prisma.classe.findMany({
      where: { actif: true },
      select: { id: true, code: true, libelle: true, ordre: true },
      orderBy: { ordre: 'asc' },
    });
  }
}