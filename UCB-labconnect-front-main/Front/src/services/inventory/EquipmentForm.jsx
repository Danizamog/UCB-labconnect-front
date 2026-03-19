import { useState } from 'react';
import { inventoryService } from '../../services/inventory.service';

const EquipmentForm = ({ onSuccess }) => {
    const [formData, setFormData] = useState({
        nombre: '', tipo: 'equipo', estado: 'Operativo', ubicacion: '',
        stock_actual: 0, umbral_minimo: 5, limite_reserva_usuario: 0,
        solo_docente: false, fecha_vencimiento: '', url_imagen: ''
    });
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!formData.nombre || !formData.ubicacion) {
            setError('Nombre y Ubicación son obligatorios.');
            return;
        }
        try {
            await inventoryService.createEquipment(formData);
            alert('Equipo registrado con éxito en el inventario');
            if(onSuccess) onSuccess();
        } catch (err) {
            setError('Error al guardar el equipo en el servidor.');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md grid grid-cols-1 md:grid-cols-2 gap-4">
            <h3 className="md:col-span-2 text-xl font-bold mb-2 border-b pb-2">Registrar Nuevo Elemento</h3>
            
            {error && <div className="md:col-span-2 bg-red-100 text-red-700 p-2 rounded">{error}</div>}

            <div><label className="block text-sm font-semibold">Nombre *</label><input type="text" name="nombre" onChange={handleChange} className="w-full border p-2 rounded mt-1" /></div>
            <div><label className="block text-sm font-semibold">Ubicación *</label><input type="text" name="ubicacion" onChange={handleChange} className="w-full border p-2 rounded mt-1" /></div>
            
            <div>
                <label className="block text-sm font-semibold">Tipo</label>
                <select name="tipo" onChange={handleChange} className="w-full border p-2 rounded mt-1">
                    <option value="equipo">Equipo</option>
                    <option value="herramienta">Herramienta</option>
                    <option value="reactivo">Reactivo</option>
                </select>
            </div>
            
            <div><label className="block text-sm font-semibold">Stock Inicial</label><input type="number" name="stock_actual" min="0" onChange={handleChange} className="w-full border p-2 rounded mt-1" /></div>
            <div><label className="block text-sm font-semibold">Umbral Mínimo (Alerta Stock Bajo)</label><input type="number" name="umbral_minimo" defaultValue={5} min="0" onChange={handleChange} className="w-full border p-2 rounded mt-1" /></div>
            <div><label className="block text-sm font-semibold">Límite por Reserva (0 = Sin límite)</label><input type="number" name="limite_reserva_usuario" min="0" onChange={handleChange} className="w-full border p-2 rounded mt-1" /></div>

            <div><label className="block text-sm font-semibold">Fecha Vencimiento (Reactivos)</label><input type="date" name="fecha_vencimiento" onChange={handleChange} className="w-full border p-2 rounded mt-1" /></div>
            <div><label className="block text-sm font-semibold">URL de Imagen</label><input type="url" name="url_imagen" placeholder="https://..." onChange={handleChange} className="w-full border p-2 rounded mt-1" /></div>
            
            <div className="md:col-span-2 flex items-center mt-2 bg-red-50 p-3 rounded border border-red-200">
                <input type="checkbox" name="solo_docente" onChange={handleChange} className="mr-3 h-5 w-5" />
                <label className="font-semibold text-red-700">Restringir: Solo Uso Docente (Bloquea a estudiantes)</label>
            </div>

            <button type="submit" className="md:col-span-2 bg-blue-600 text-white p-3 rounded mt-4 hover:bg-blue-700 transition font-bold">Guardar en Inventario</button>
        </form>
    );
};

export default EquipmentForm;