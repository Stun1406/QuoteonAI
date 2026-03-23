import type { QuoteExtraction, QuoteResult, QuoteLineItem } from '../types/quote'
import { TRANSLOADING_RATES, STORAGE_RATES } from './pricing-data'

export function calculateWarehouseQuote(
  extraction: QuoteExtraction,
  discountPct: number = 0
): QuoteResult {
  const lineItems: QuoteLineItem[] = []
  const warnings: string[] = []

  // ── Transloading ──────────────────────────────────────────────────────────
  if (extraction.transloading.enabled && extraction.transloading.containers.length > 0) {
    for (const container of extraction.transloading.containers) {
      const containerLabel = container.containerSize ?? '40ft'
      const count = container.containerCount || 1

      if (container.cargoPackaging === 'loose-cargo') {
        const pieces = container.looseCargoCount || 0
        let containerRate: number

        if (pieces <= 500) {
          containerRate = TRANSLOADING_RATES.looseCargo.tier1.rate
        } else if (pieces <= 1000) {
          containerRate = TRANSLOADING_RATES.looseCargo.tier2.rate
        } else if (pieces <= 1500) {
          containerRate = TRANSLOADING_RATES.looseCargo.tier3.rate
        } else {
          containerRate = +(pieces * TRANSLOADING_RATES.looseCargo.tier4.ratePerPc).toFixed(2)
        }

        lineItems.push({
          description: `Transloading — Loose Cargo ${pieces > 0 ? pieces + ' pcs' : ''} (${containerLabel})`,
          quantity: count,
          unitPrice: containerRate,
          total: count * containerRate,
        })
      } else {
        // Palletized — flat rate by container size
        const rate = TRANSLOADING_RATES.palletized[containerLabel]
          ?? TRANSLOADING_RATES.palletized['40ft']

        const pallets = container.palletCount || TRANSLOADING_RATES.defaultPalletsPerContainer[containerLabel] || 20

        lineItems.push({
          description: `Transloading — Palletized ${pallets} pallets (${containerLabel})`,
          quantity: count,
          unitPrice: rate,
          total: count * rate,
        })
      }
    }

    // Palletize + Shrink wrap ($15/pallet)
    if (extraction.transloading.shrinkWrap) {
      const swPallets = extraction.transloading.shrinkWrapPalletCount
        || extraction.transloading.containers.reduce((sum, c) => sum + (c.palletCount || 0), 0)
      if (swPallets > 0) {
        lineItems.push({
          description: 'Palletize + Shrink Wrap',
          quantity: swPallets,
          unitPrice: TRANSLOADING_RATES.palletizeShrinkWrap,
          total: swPallets * TRANSLOADING_RATES.palletizeShrinkWrap,
        })
      }
    }

    // BOL ($5/BOL)
    if (extraction.transloading.billOfLading) {
      const bolCount = extraction.transloading.containers.length || 1
      lineItems.push({
        description: 'Bill of Lading',
        quantity: bolCount,
        unitPrice: TRANSLOADING_RATES.billOfLading,
        total: bolCount * TRANSLOADING_RATES.billOfLading,
      })
    }

    // Seal ($5/seal)
    if (extraction.transloading.seal) {
      const sealCount = extraction.transloading.containers.length || 1
      lineItems.push({
        description: 'Seal',
        quantity: sealCount,
        unitPrice: TRANSLOADING_RATES.seal,
        total: sealCount * TRANSLOADING_RATES.seal,
      })
    }
  }

  // ── Storage / Warehousing ─────────────────────────────────────────────────
  if (extraction.storage.enabled && extraction.storage.palletCount > 0) {
    const pallets = extraction.storage.palletCount
    const days = extraction.storage.storageDurationDays || 30
    const isOversize = extraction.storage.palletSize === 'oversize'

    // Handling in + out
    lineItems.push({
      description: `Handling In & Out — ${pallets} pallets`,
      quantity: pallets,
      unitPrice: STORAGE_RATES.handlingInOutPerPallet,
      total: pallets * STORAGE_RATES.handlingInOutPerPallet,
    })

    // Storage: first 48 hrs free, then weekly for days 3-7, then monthly
    if (days > 2) {
      const monthlyRate = isOversize
        ? STORAGE_RATES.oversizePalletPerMonth
        : STORAGE_RATES.normalPalletPerMonth

      const storageAmount = +((days / 30) * monthlyRate * pallets).toFixed(2)

      lineItems.push({
        description: `Storage — ${pallets} pallets × ${days} days`,
        quantity: 1,
        unitPrice: storageAmount,
        total: storageAmount,
        note: isOversize
          ? `Oversize pallet rate ($${STORAGE_RATES.oversizePalletPerMonth}/pallet/month)`
          : `$${STORAGE_RATES.normalPalletPerMonth}/pallet/month (first 48 hrs free)`,
      })
    }

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
        description: 'Weekend Open Fee (Sat–Sun)',
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
