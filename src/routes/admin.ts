import { Router } from 'express';
import { adminController } from '../controllers/adminController';

const router = Router();

// Registration Keys
router.post('/keys', adminController.createRegistrationKey);
router.get('/keys', adminController.getRegistrationKeys);
router.patch('/keys/:id/revoke', adminController.revokeRegistrationKey);

// Tenant Management
router.get('/tenants', adminController.getTenants);
router.post('/tenants', adminController.createTenant);
router.delete('/tenants/:id', adminController.deleteTenant);

// Global Metrics
router.get('/metrics', adminController.getGlobalMetrics);

export default router;