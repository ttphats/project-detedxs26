/**
 * Generate QR codes for all PAID orders that don't have one
 */
import {prisma} from '../dist/db/prisma.js'
import * as qrcodeService from '../dist/services/qrcode.service.js'

async function generateMissingQRCodes() {
  try {
    console.log('🔍 Re-generating QR codes for all PAID orders...')

    // Find all PAID orders (including ones with existing QR codes)
    const orders = await prisma.order.findMany({
      where: {
        status: 'PAID',
      },
      include: {
        event: true,
      },
    })

    console.log(`📊 Found ${orders.length} PAID orders`)

    if (orders.length === 0) {
      console.log('✅ No PAID orders found!')
      return
    }

    let successCount = 0
    let failCount = 0

    for (const order of orders) {
      try {
        console.log(`\n🎫 Processing order: ${order.orderNumber}`)

        // Generate QR code
        const qrCodeUrl = await qrcodeService.generateTicketQRCode(
          order.orderNumber,
          order.eventId
        )

        // Update order with QR code URL
        await prisma.order.update({
          where: {id: order.id},
          data: {qrCodeUrl},
        })

        console.log(`   ✅ Generated QR code: ${qrCodeUrl}`)
        successCount++
      } catch (error) {
        console.error(`   ❌ Failed for ${order.orderNumber}:`, error.message)
        failCount++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY:')
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   📋 Total: ${orders.length}`)
    console.log('='.repeat(60))
  } catch (error) {
    console.error('❌ Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

generateMissingQRCodes()
