import { FastifyRequest, FastifyReply } from 'fastify';
import * as customersService from '../../services/admin/customers.service.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/customers
 * List all customers with check-in status
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { eventId, search } = request.query as { eventId?: string; search?: string };

    const data = await customersService.listCustomers(eventId, search);

    return reply.send({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Get customers error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to fetch customers',
    });
  }
}

/**
 * GET /api/admin/customers/:id
 * Get customer details by order ID
 */
export async function getById(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { id } = request.params as { id: string };

    const customer = await customersService.getCustomerByOrderId(id);

    if (!customer) {
      return reply.status(404).send({
        success: false,
        error: 'Customer not found',
      });
    }

    return reply.send({
      success: true,
      data: customer,
    });
  } catch (error: any) {
    console.error('Get customer error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to fetch customer',
    });
  }
}
