import { useEffect, useMemo, useState } from "react";
import { PracticeRequestResponse } from "../../reservations/types/reservation";
import { createAssetLoan, getAssetLoans, getAssets, returnAssetLoan } from "../api/inventoryAdminApi";
import { getAllLabs } from "../api/labsAdminApi";
import { Asset, AssetLoan } from "../types/inventory";
import { Lab } from "../types/lab";

type Props = {
  reservations: PracticeRequestResponse[];
};

export default function AdminTrackingPage({ reservations }: Props) {
  const token = localStorage.getItem("token") || "";
  const [labs, setLabs] = useState<Lab[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<AssetLoan[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loanForm, setLoanForm] = useState({
    asset_id: 0,
    borrower_name: "",
    borrower_email: "",
    quantity: 1,
    due_at: "",
    notes: "",
  });

  const loadData = async (labId?: number) => {
    try {
      const [labsData, assetsData, loansData] = await Promise.all([
        getAllLabs(token),
        getAssets(token, labId),
        getAssetLoans(token),
      ]);
      setLabs(labsData);
      setAssets(assetsData);
      setLoans(loansData);
      setLoanForm((prev) => ({ ...prev, asset_id: prev.asset_id || assetsData[0]?.id || 0 }));
    } catch (err: any) {
      setError(err.message || "No se pudo cargar el historial operativo");
    }
  };

  useEffect(() => {
    loadData(selectedLabId);
  }, [selectedLabId]);

  const approvedReservations = useMemo(
    () =>
      reservations.filter((item) => item.status === "approved" && (!selectedLabId || item.laboratory_id === selectedLabId)),
    [reservations, selectedLabId]
  );

  const visibleLoans = useMemo(
    () =>
      loans.filter((loan) => {
        if (!selectedLabId) return true;
        const asset = assets.find((item) => item.id === loan.asset_id);
        return asset?.laboratory_id === selectedLabId;
      }),
    [loans, assets, selectedLabId]
  );

  const validateLoan = () => {
    if (!loanForm.asset_id) return "Debes seleccionar un equipo.";
    if (!loanForm.borrower_name.trim()) return "El responsable es obligatorio.";
    if (!loanForm.borrower_email.trim()) return "El correo es obligatorio.";
    if (loanForm.quantity <= 0) return "La cantidad debe ser mayor a 0.";
    return "";
  };

  return (
    <div className="content-stack">
      <div className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Control operativo y trazabilidad</h2>
            <p className="section-copy">Consulta reservas aprobadas del laboratorio y gestiona el prestamo real de equipos en un espacio separado.</p>
          </div>
        </div>

        <select
          className="select"
          value={selectedLabId || ""}
          onChange={(e) => setSelectedLabId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Todos los laboratorios</option>
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>{lab.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <div className="grid-2">
        <div className="card">
          <h2 className="section-title">Historial automatico de reservas aprobadas</h2>
          <p className="section-copy">Toda reserva aceptada por el administrador aparece automaticamente aqui.</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Responsable</th>
                  <th>Laboratorio</th>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {approvedReservations.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No hay reservas aprobadas para este filtro.</td>
                  </tr>
                ) : (
                  approvedReservations.map((item) => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>{item.laboratory_name}</td>
                      <td>{item.date}</td>
                      <td>{item.start_time} - {item.end_time}</td>
                      <td>{item.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <form
          className="card professional-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            setSuccess("");
            const validationError = validateLoan();
            if (validationError) {
              setError(validationError);
              return;
            }
            createAssetLoan(
              {
                asset_id: loanForm.asset_id,
                borrower_name: loanForm.borrower_name.trim(),
                borrower_email: loanForm.borrower_email.trim(),
                quantity: loanForm.quantity,
                due_at: loanForm.due_at || undefined,
                notes: loanForm.notes.trim() || undefined,
              },
              token
            )
              .then(() => {
                setSuccess("Prestamo registrado correctamente.");
                setLoanForm({
                  asset_id: loanForm.asset_id,
                  borrower_name: "",
                  borrower_email: "",
                  quantity: 1,
                  due_at: "",
                  notes: "",
                });
                return loadData(selectedLabId);
              })
              .catch((err: any) => setError(err.message || "No se pudo registrar el prestamo"));
          }}
        >
          <h2 className="section-title">Registrar prestamo de equipo</h2>
          <p className="section-copy">Formaliza quien uso un recurso, por cuanto tiempo y en que cantidad.</p>

          <div className="field">
            <label>Equipo</label>
            <select className="select" value={loanForm.asset_id} onChange={(e) => setLoanForm({ ...loanForm, asset_id: Number(e.target.value) })}>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} Disponible {asset.quantity_available}/{asset.quantity_total}
                </option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Responsable</label>
              <input className="input" value={loanForm.borrower_name} onChange={(e) => setLoanForm({ ...loanForm, borrower_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Correo</label>
              <input className="input" type="email" value={loanForm.borrower_email} onChange={(e) => setLoanForm({ ...loanForm, borrower_email: e.target.value })} />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Cantidad prestada</label>
              <input className="input" type="number" min={1} value={loanForm.quantity} onChange={(e) => setLoanForm({ ...loanForm, quantity: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Fecha limite</label>
              <input className="input" type="datetime-local" value={loanForm.due_at} onChange={(e) => setLoanForm({ ...loanForm, due_at: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label>Observaciones</label>
            <textarea className="textarea" value={loanForm.notes} onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })} />
          </div>

          <button type="submit" className="btn btn-primary">Registrar prestamo</button>
        </form>
      </div>

      <div className="card">
        <h2 className="section-title">Historial de prestamos y devoluciones</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Equipo</th>
                <th>Laboratorio</th>
                <th>Responsable</th>
                <th>Cantidad</th>
                <th>Fecha limite</th>
                <th>Estado</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {visibleLoans.length === 0 ? (
                <tr>
                  <td colSpan={7}>No hay prestamos registrados para este filtro.</td>
                </tr>
              ) : (
                visibleLoans.map((loan) => {
                  const asset = assets.find((item) => item.id === loan.asset_id);
                  const lab = labs.find((item) => item.id === asset?.laboratory_id);
                  return (
                    <tr key={loan.id}>
                      <td>{asset?.name || `Equipo ${loan.asset_id}`}</td>
                      <td>{lab?.name || "-"}</td>
                      <td>{loan.borrower_name}<br />{loan.borrower_email}</td>
                      <td>{loan.quantity}</td>
                      <td>{loan.due_at || "-"}</td>
                      <td>{loan.status}</td>
                      <td>
                        {loan.status === "loaned" ? (
                          <button
                            className="btn btn-secondary"
                            onClick={() =>
                              returnAssetLoan(loan.id, token)
                                .then(() => {
                                  setSuccess("Devolucion registrada correctamente.");
                                  return loadData(selectedLabId);
                                })
                                .catch((err: any) => setError(err.message || "No se pudo registrar la devolucion"))
                            }
                          >
                            Registrar devolucion
                          </button>
                        ) : (
                          "Devuelto"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
