import { useState } from 'react';
import { inventoryService } from '../../services/inventory.service';

const StockUpdateModal = ({ equipo, onClose, onUpdate }) => {
    const [cantidad, setCantidad] = useState(1);
    const [tipoMovimiento, setTipoMovimiento] = useState('ingreso');

    const handleUpdate = async () => {
        try {
            await inventoryService.updateStock(equipo._id, {
                cantidad: Number(cantidad),
                tipo_movimiento: tipoMovimiento,
                usuarioId: 'admin-123' // ID temporal simulando la sesión
            });
            alert('Stock actualizado exitosamente');
            onUpdate();
            onClose();
        } catch (error) {
            alert(error.response?.data?.error || 'Error al actualizar el stock');
        }
    };

    if (!equipo) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
                <h3 className="text-xl font-bold mb-2">Actualizar Stock: {equipo.nombre}</h3>
                <p className="mb-4 text-gray-600">Stock Actual en sistema: <span className="font-bold text-black">{equipo.stock_actual}</span></p>
                
                <label className="block text-sm font-semibold mb-1">Tipo de Movimiento</label>
                <select value={tipoMovimiento} onChange={(e) => setTipoMovimiento(e.target.value)} className="w-full border p-2 mb-4 rounded">
                    <option value="ingreso">Agregar Stock (Ingreso / Compra)</option>
                    <option value="devolucion">Agregar Stock (Devolución)</option>
                    <option value="consumo">Descontar Stock (Consumo / Merma)</option>
                </select>

                <label className="block text-sm font-semibold mb-1">Cantidad a modificar</label>
                <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-full border p-2 mb-6 rounded" placeholder="Ej. 5" />

                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition">Cancelar</button>
                    <button onClick={handleUpdate} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">Confirmar Movimiento</button>
                </div>
            </div>
        </div>
    );
};

export default StockUpdateModal;