import prisma from '../utils/prisma.js';
import { validateStockAdjustment } from '../validation/stock.validation.js';

export const adjustStock = async (req, res) => {
  const { error, value } = validateStockAdjustment(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    const currentStockLevel = await prisma.stockLedger.aggregate({
      where: { variantId: value.variantId },
      _sum: { quantityChange: true },
    });
    const currentStock = currentStockLevel._sum.quantityChange || 0;
    if (currentStock + value.quantityChange < 0) {
      return res.status(400).json({ message: 'Stok tidak boleh kurang dari 0' });
    }

    const ledgerEntry = await prisma.stockLedger.create({
      data: {
        variantId: value.variantId,
        quantityChange: value.quantityChange,
        reason: value.reason,
        userId: req.user.id,
      },
    });

    res.status(201).json(ledgerEntry);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2003') {
      return res.status(404).json({ message: 'Product Variant not found' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getStockLevel = async (req, res) => {
  const { variantId } = req.params;
  try {
    const result = await prisma.stockLedger.aggregate({
      where: { variantId },
      _sum: {
        quantityChange: true,
      },
    });

    res.status(200).json({
      variantId,
      currentStock: result._sum.quantityChange || 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
};
