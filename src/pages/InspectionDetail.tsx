import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../utils/apiClient";

export default function InspectionDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`admin/inspections/${id}`).then((res) => {
            setData(res.data);
            setLoading(false);
        });
    }, [id]);

    if (loading) return <div className="p-6">Loading inspection…</div>;
    if (!data?.inspection) return <div>No data found</div>;

    const { inspection, stages, tests, batches, events } = data;

    return (
        <div className="space-y-6">

            {/* HEADER */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">
                    Inspection #{inspection.id}
                </h1>
                <button
                    onClick={() => navigate(-1)}
                    className="border px-3 py-1 rounded hover:bg-gray-100"
                >
                    Back
                </button>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <InfoCard label="PO Number" value={inspection.po?.po_number} />
                <InfoCard label="Vendor" value={inspection.po?.vendor_name} />
                <InfoCard label="Inspector" value={inspection.inspector?.name} />
                <InfoCard label="Status" value={inspection.status} highlight />
            </div>

            {/* SCHEDULE + LOCATION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard
                    label="Schedule"
                    value={new Date(inspection.schedule_datetime).toLocaleString()}
                />
                <InfoCard
                    label="Inspection Location"
                    value={inspection.inspection_location}
                />
            </div>

            {/* ITEMS */}
            <Section title="Item Details">
                <div className="grid grid-cols-3 gap-4">
                    <InfoCard label="Item" value={inspection.item?.item_name} />
                    <InfoCard label="Quantity" value={inspection.item?.quantity} />
                    <InfoCard label="Item ID" value={inspection.item?.id} />
                </div>
            </Section>

            {/* STAGE TIMELINE */}
            {/* STAGE + TESTS */}
            {/* STAGE + TESTS */}
            <Section title="Stage-wise Test Progress">
                <div className="space-y-5">

                    {stages.map((stage: any, idx: number) => {
                        const stageTests = tests.filter(
                            (t: any) => t.po_stage_id === stage.id
                        );

                        return (
                            <div key={stage.id} className="border rounded-xl p-5 bg-white">

                                {/* STAGE HEADER */}
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold">
                                        {idx + 1}
                                    </div>

                                    <div className="flex-1">
                                        <div className="font-semibold text-lg">
                                            {stage.Stage?.stage_name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Stage Status: {stage.status || "pending"}
                                        </div>
                                    </div>
                                </div>

                                {/* ITEM INFO (VERY IMPORTANT FOR HOD) */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 ml-13">
                                    <InfoCard
                                        label="Item Name"
                                        value={inspection.item?.item_name}
                                    />
                                    <InfoCard
                                        label="Quantity"
                                        value={inspection.item?.quantity}
                                    />
                                    <InfoCard
                                        label="Item ID"
                                        value={inspection.item?.id}
                                    />
                                    <InfoCard
                                        label="Item Remark"
                                        value={inspection.item?.remark || "-"}
                                    />
                                </div>

                                {/* TEST TABLE */}
                                {stageTests.length === 0 ? (
                                    <div className="text-sm text-gray-400 ml-14">
                                        No tests performed in this stage
                                    </div>
                                ) : (
                                    <div className="ml-14 overflow-x-auto">
                                        <table className="w-full text-sm border rounded">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="border p-2 text-left">Test</th>
                                                    <th className="border p-2">Inspector</th>
                                                    <th className="border p-2">GPS</th>

                                                    <th className="border p-2">Result</th>
                                                    <th className="border p-2">Remark</th>
                                                    <th className="border p-2">Document</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stageTests.map((t: any) => (
                                                    <tr key={t.id}>
                                                        <td className="border p-2">
                                                            {t.Test?.test_name}
                                                        </td>

                                                        <td className="border p-2 text-center">
                                                            {t.po_stage?.StageInspector?.name || "-"}
                                                        </td>
                                                        <td className="border p-2 text-center">
                                                            {t.gps_location && !["Fetching...", "Error"].includes(t.gps_location) ? (
                                                                <button
                                                                    onClick={() => openMap(t.gps_location)}
                                                                    className="text-blue-600 underline hover:text-blue-800 font-mono text-xs"
                                                                    title="Open in Google Maps"
                                                                >
                                                                    {t.gps_location}
                                                                </button>
                                                            ) : (
                                                                <span className="text-gray-400 text-xs">
                                                                    {t.gps_location || "-"}
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="border p-2 text-center">
                                                            <span
                                                                className={`px-2 py-1 rounded text-xs font-medium ${t.result === "pass"
                                                                    ? "bg-green-100 text-green-700"
                                                                    : t.result === "fail"
                                                                        ? "bg-red-100 text-red-700"
                                                                        : "bg-gray-100 text-gray-600"
                                                                    }`}
                                                            >
                                                                {t.result || "pending"}
                                                            </span>
                                                        </td>

                                                        <td className="border p-2">
                                                            {t.remark || "-"}
                                                        </td>

                                                        <td className="border p-2 text-center">
                                                            {t.document_url ? (
                                                                <a
                                                                    href={t.document_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 underline hover:text-blue-800"
                                                                >
                                                                    View
                                                                </a>
                                                            ) : (
                                                                <span className="text-gray-400">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Section>


            {/* BATCH / REPORT */}
            <Section title="Inspection Batches">
                {batches.map((b: any) => (
                    <div key={b.id} className="border rounded p-3 mb-2">
                        <div className="flex justify-between">
                            <div>Batch #{b.id}</div>
                            <div
                                className={`text-sm ${b.result === "fail" ? "text-red-600" : "text-green-600"
                                    }`}
                            >
                                {b.result || "pending"}
                            </div>
                        </div>
                    </div>
                ))}
            </Section>

            {/* ACTIVITY LOG */}
            <Section title="Activity Log">
                <div className="space-y-2 text-sm text-gray-600">
                    {events.map((e: any) => (
                        <div key={e.id}>
                            • {e.type} —{" "}
                            {new Date(e.createdAt).toLocaleString()}
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}

/* ---------------- UI HELPERS ---------------- */

function InfoCard({ label, value, highlight }: any) {
    return (
        <div
            className={`border rounded p-4 ${highlight ? "bg-blue-50 border-blue-300" : ""
                }`}
        >
            <div className="text-xs text-gray-500">{label}</div>
            <div className="font-semibold mt-1">{value || "-"}</div>
        </div>
    );
}
function openMap(gps: string) {
    if (!gps || gps === "Fetching..." || gps === "Error") return;
    const url = `https://www.google.com/maps?q=${gps}`;
    window.open(url, "_blank");
}

function Section({ title, children }: any) {
    return (
        <div>
            <h2 className="text-lg font-semibold mb-3">{title}</h2>
            {children}
        </div>
    );
}
