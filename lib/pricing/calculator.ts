import type { QuoteExtraction, QuoteResult, QuoteLineItem } from '../types/quote'
import { TRANSLOADING_RATES, STORAGE_RATES } from './pricing-data'

export function calculateWarehouseQuote(
  extraction: QuoteExtraction,
  discountPct: number = 0
): QuoteResult {
  const lineItems: QuoteLineItem[] = []
  const warnings: string[] = []

  // Transloading
  if (extraction.transloading.enabled && extraction.transloading.containers.length > 0) {
    for (const container of extraction.transloading.containers) {
      const containerLabel = container.containerSize ?? 'container'
      const count = container.containerCount || 1

      if (container.cargoPackaging === 'loose-cargo') {
        const cartons = container.looseCargoCount || 0
        if (cartons > 0) {
          let cartonCost = 0
          if (cartons <= 50) {
            cartonCost = cartons * TRANSLOADING_RATES.looseCargo.tier1.rate
          } else if (cartons <= 200) {
            cartonCost = 50 * TRANSLOADING_RATES.looseCargo.tier1.rate +
              (cartons - 50) * TRANSLOADING_RATES.looseCargo.tier2.rate
          } else {
            cartonCost = 50 * TRANSLOADING_RATES.looseCargo.tier1.rate +
              150 * TRANSLOADING_RATES.looseCargo.tier2.rate +
              (cartons - 200) * TRANSLOADING_RATES.looseCargo.tier3.rate
          }
          lineItems.push({
            description: `Loose Cargo Handling — ${cartons} cartons (${containerLabel})`,
            quantity: count,
            unitPrice: cartonCost,
            total: count * cartonCost,
          })
        }
      } else {
        // Pallet-based
        const defaultPallets = TRANSLOADING_RATES.defaultPalletsPerContainer[containerLabel] ?? 20
        const pallets = container.palletCount || defaultPallets
        const isOversize = extraction.storage.palletSize === 'oversize'

        let palletCost: number
        if (isOversize) {
          palletCost = pallets * TRANSLOADING_RATES.oversizePallet
        } else {
          if (pallets <= 20) {
            palletCost = pallets * TRANSLOADING_RATES.normalPalletFirst20
          } else {
            palletCost = 20 * TRANSLOADING_RATES.normalPalletFirst20 +
              (pallets - 20) * TRANSLOADING_RATES.normalPalletAfter20
          }
        }

        lineItems.push({
          description: `Transloading — ${pallets} pallets (${containerLabel})`,
          quantity: count,
          unitPrice: palletCost,
          total: count * palletCost,
          note: isOversize ? 'Oversize pallet rate' : undefined,
        })
      }
    }

    // Shrink wrap
    if (extraction.transloading.shrinkWrap) {
      const swPallets = extraction.transloading.shrinkWrapPalletCount ||
        extraction.transloading.containers.reduce((sum, c) => sum + (c.palletCount || 0), 0)
      if (swPallets > 0) {
        lineItems.push({
          description: 'Shrink Wrap',
          quantity: swPallets,
          unitPrice: TRANSLOADING_RATES.shrinkWrapPerPallet,
          total: swPallets * TRANSLOADING_RATES.shrinkWrapPerPallet,
        })
      }
    }

    // BOL
    if (extraction.transloading.billOfLading) {
      const bolCount = extraction.transloading.containers.length || 1
      lineItems.push({
        description: 'Bill of Lading',
        quantity: bolCount,
        unitPrice: TRANSLOADING_RATES.bolPerBol,
        total: bolCount * TRANSLOADING_RATES.bolPerBol,
      })
    }

    // Seal
    if (extraction.transloading.seal) {
      const sealCount = extraction.transloading.containers.length || 1
      lineItems.push({
        description: 'Seal',
        quantity: sealCount,
        unitPrice: TRANSLOADING_RATES.sealPerSeal,
        total: sealCount * TRANSLOADING_RATES.sealPerSeal,
      })
    }
  }

  // Storage
  if (extraction.storage.enabled && extraction.storage.palletCount > 0) {
    const pallets = extraction.storage.palletCount
    const days = extraction.storage.storageDurationDays || 30
    const isOversize = extraction.storage.palletSize === 'oversize'
    const monthlyRate = isOversize ? STORAGE_RATES.oversizePalletPerMonth : STORAGE_RATES.normalPalletPerMonth
    const storageAmount = (days / 30) * monthlyRate * pallets

    lineItems.push({
      description: `Storage — ${pallets} pallets × ${days} days`,
      quantity: 1,
      unitPrice: storageAmount,
      total: storageAmount,
      note: isOversize ? 'Oversize pallet rate ($25/pallet/month)' : '$18/pallet/month',
    })

    if (extraction.storage.monFriAfterHours) {
      lineItems.push({
        description: 'After-Hours Access (Mon–Fri)',
        quantity: 1,
        unitPrice: STORAGE_RATES.afterHoursMonFri,
        total: STORAGE_RATES.afterHoursMonFri,
      })
    }

    if (extraction.storage.satSun) {
      lineItems.push({
        description: 'Weekend Access (Sat–Sun)',
        quantity: 1,
        unitPrice: STORAGE_RATES.weekendSatSun,
        total: STORAGE_RATES.weekendSatSun,
      })
    }
  }

  if (lineItems.length === 0) {
    warnings.push('No pricing items could be calculated. Please provide container and cargo details.')
  }

  if (extraction.confirmationNeeded.length > 0) {
    warnings.push(`The following details were assumed: ${extraction.confirmationNeeded.join(', ')}`)
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const discountAmount = discountPct > 0 ? +(subtotal * discountPct / 100).toFixed(2) : 0
  const total = +(subtotal - discountAmount).toFixed(2)

  return { lineItems, subtotal: +subtotal.toFixed(2), discountPct, discountAmount, total, warnings }
}
