import axios from 'axios';

const API_URL = import.meta.env.VITE_INVENTORY_API_URL;

export const inventoryService = {
    // SCRUM-7, 190, 191, 198, 199
    createEquipment: async (data) => {
        const response = await axios.post(`${API_URL}/equipment`, data);
        return response.data;
    },

    // SCRUM-200
    getMaintenanceEquipment: async () => {
        const response = await axios.get(`${API_URL}/equipment/maintenance`);
        return response.data;
    },

    // SCRUM-201
    getLowStockEquipment: async () => {
        const response = await axios.get(`${API_URL}/equipment/low-stock`);
        return response.data;
    },

    // SCRUM-9
    updateStock: async (id, data) => {
        const response = await axios.patch(`${API_URL}/equipment/${id}/stock`, data);
        return response.data;
    }
};