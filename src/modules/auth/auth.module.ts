import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JetonsService } from './jetons.service.js';

@Module({
  imports: [
    // JwtModule est GLOBAL : le guard (déclaré dans AppModule) peut utiliser JwtService.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCES_SECRET'),
        signOptions: {
          expiresIn: Number(config.getOrThrow('JWT_ACCES_DUREE_SECONDES')), // en secondes
          algorithm: 'HS256' as const,
        },
        verifyOptions: { algorithms: ['HS256' as const] }, // on refuse tout autre algorithme
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JetonsService],
  exports: [AuthService],
})
export class AuthModule {}