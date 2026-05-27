import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductosService } from '../productos/productos.service';
import { CreateOrdenDto } from './ordenes.dto';
import MercadoPagoConfig, { Preference, Payment } from 'mercadopago';

@Injectable()
export class OrdenesService {
  private mp: MercadoPagoConfig;

  constructor(
    private prisma: PrismaService,
    private productosService: ProductosService,
  ) {
    this.mp = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
    });
  }

  async crear(dto: CreateOrdenDto, baseUrl: string) {
    const productosConCantidad = await Promise.all(
      dto.items.map(async (item) => {
        const producto = await this.productosService.findById(item.productoId);
        if (producto.stock < item.cantidad) {
          throw new BadRequestException(`Stock insuficiente para ${producto.nombre}`);
        }
        return { producto, cantidad: item.cantidad };
      }),
    );

    const total = productosConCantidad.reduce(
      (sum, { producto, cantidad }) => sum + Number(producto.precio) * cantidad,
      0,
    );

    const orden = await this.prisma.orden.create({
      data: {
        nombreComprador: dto.nombreComprador,
        emailComprador: dto.emailComprador,
        telefonoComprador: dto.telefonoComprador,
        total,
        items: {
          create: productosConCantidad.map(({ producto, cantidad }) => ({
            productoId: producto.id,
            cantidad,
            precio: producto.precio,
          })),
        },
      },
      include: { items: { include: { producto: true } } },
    });

    const preference = new Preference(this.mp);
    const mpResponse = await preference.create({
      body: {
        items: productosConCantidad.map(({ producto, cantidad }) => ({
          id: String(producto.id),
          title: producto.nombre,
          quantity: cantidad,
          unit_price: Number(producto.precio),
          currency_id: 'COP',
        })),
        payer: {
          name: dto.nombreComprador,
          email: dto.emailComprador,
        },
        back_urls: {
          success: `${baseUrl}/orden/confirmacion?ordenId=${orden.id}&estado=pagado`,
          failure: `${baseUrl}/orden/confirmacion?ordenId=${orden.id}&estado=cancelado`,
          pending: `${baseUrl}/orden/confirmacion?ordenId=${orden.id}&estado=pendiente`,
        },
        auto_return: 'approved',
        external_reference: String(orden.id),
        notification_url: `${process.env.API_URL ?? baseUrl}/api/ordenes/webhook`,
      },
    });

    await this.prisma.orden.update({
      where: { id: orden.id },
      data: { mpPreferenceId: mpResponse.id },
    });

    return { orden, initPoint: mpResponse.init_point };
  }

  async procesarWebhook(tipo: string, paymentId: string) {
    if (tipo !== 'payment') return;

    const payment = new Payment(this.mp);
    const mpPayment = await payment.get({ id: paymentId });

    const ordenId = Number(mpPayment.external_reference);
    if (!ordenId) return;

    const orden = await this.prisma.orden.findUnique({ where: { id: ordenId } });
    if (!orden) return;

    if (mpPayment.status === 'approved') {
      await this.prisma.orden.update({
        where: { id: ordenId },
        data: { estado: 'PAGADO', mpPaymentId: paymentId },
      });

      const items = await this.prisma.itemOrden.findMany({ where: { ordenId } });
      await Promise.all(
        items.map((item) =>
          this.prisma.producto.update({
            where: { id: item.productoId },
            data: { stock: { decrement: item.cantidad } },
          }),
        ),
      );
    } else if (mpPayment.status === 'cancelled' || mpPayment.status === 'rejected') {
      await this.prisma.orden.update({
        where: { id: ordenId },
        data: { estado: 'CANCELADO' },
      });
    }
  }

  findAll(soloNoPagadas?: boolean) {
    return this.prisma.orden.findMany({
      where: soloNoPagadas ? { estado: 'PENDIENTE' } : undefined,
      include: { items: { include: { producto: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const orden = await this.prisma.orden.findUnique({
      where: { id },
      include: { items: { include: { producto: true } } },
    });
    if (!orden) throw new NotFoundException('Orden no encontrada');
    return orden;
  }

  actualizarEstado(id: number, estado: string) {
    return this.prisma.orden.update({ where: { id }, data: { estado: estado as any } });
  }

  estadisticas() {
    return this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('day', "createdAt") AS dia,
        COUNT(*) AS total_ordenes,
        SUM(total) AS ingresos
      FROM "Orden"
      WHERE estado = 'PAGADO'
        AND "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY dia
      ORDER BY dia DESC
    `;
  }
}
