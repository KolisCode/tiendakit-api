import {
  Body, Controller, Get, Headers, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { OrdenesService } from './ordenes.service';
import { ActualizarEstadoDto, CreateOrdenDto, WebhookMpDto } from './ordenes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ordenes')
export class OrdenesController {
  constructor(private service: OrdenesService) {}

  @Post()
  crear(@Body() dto: CreateOrdenDto, @Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.service.crear(dto, baseUrl);
  }

  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Body() body: WebhookMpDto,
    @Headers('x-signature') xSignature?: string,
  ) {
    if (!this.service.verificarFirmaWebhook(body.data?.id, xSignature)) return;
    return this.service.procesarWebhook(body.type ?? '', body.data?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query('pendientes') pendientes?: string) {
    return this.service.findAll(pendientes === 'true');
  }

  @UseGuards(JwtAuthGuard)
  @Get('estadisticas')
  estadisticas() {
    return this.service.estadisticas();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/estado')
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEstadoDto,
  ) {
    return this.service.actualizarEstado(id, dto.estado);
  }
}
