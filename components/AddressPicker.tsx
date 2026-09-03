"use client";

import { useEffect, useState } from "react";

type NameCode = { code: string; name: string };
export type AddressValue = {
  province: NameCode | null;
  district: NameCode | null;
  ward: NameCode | null;
  addressDetail: string;
};

const API = "https://provinces.open-api.vn/api";

const fieldCls =
  "mt-2 w-full border-0 border-b border-dashed border-ink/40 bg-transparent pb-1.5 text-base text-ink outline-none transition-colors focus:border-solid focus:border-brass disabled:opacity-40";

function Label({ idx, children }: { idx: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
      <span className="font-mono text-brass">{idx}</span>
      {children}
    </span>
  );
}

export default function AddressPicker({
  onChange,
}: {
  onChange: (v: AddressValue) => void;
}) {
  const [provinces, setProvinces] = useState<NameCode[]>([]);
  const [districts, setDistricts] = useState<NameCode[]>([]);
  const [wards, setWards] = useState<NameCode[]>([]);

  const [province, setProvince] = useState<NameCode | null>(null);
  const [district, setDistrict] = useState<NameCode | null>(null);
  const [ward, setWard] = useState<NameCode | null>(null);
  const [addressDetail, setAddressDetail] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${API}/p/`)
      .then((r) => r.json())
      .then((d: NameCode[]) => setProvinces(d.map((x) => ({ code: String(x.code), name: x.name }))))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    onChange({ province, district, ward, addressDetail });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province, district, ward, addressDetail]);

  async function pickProvince(code: string) {
    const p = provinces.find((x) => x.code === code) ?? null;
    setProvince(p);
    setDistrict(null);
    setWard(null);
    setDistricts([]);
    setWards([]);
    if (!p) return;
    try {
      const d = await fetch(`${API}/p/${code}?depth=2`).then((r) => r.json());
      setDistricts(
        (d.districts ?? []).map((x: NameCode) => ({
          code: String(x.code),
          name: x.name,
        })),
      );
    } catch {
      setFailed(true);
    }
  }

  async function pickDistrict(code: string) {
    const d = districts.find((x) => x.code === code) ?? null;
    setDistrict(d);
    setWard(null);
    setWards([]);
    if (!d) return;
    try {
      const w = await fetch(`${API}/d/${code}?depth=2`).then((r) => r.json());
      setWards(
        (w.wards ?? []).map((x: NameCode) => ({
          code: String(x.code),
          name: x.name,
        })),
      );
    } catch {
      setFailed(true);
    }
  }

  if (failed) {
    // fallback: nhập tay 1 ô nếu API tỉnh/huyện lỗi
    return (
      <label className="block sm:col-span-2">
        <Label idx="03">Địa chỉ nhận sách</Label>
        <input
          className={fieldCls}
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
          onChange={(e) => {
            setAddressDetail(e.target.value);
            setProvince({ code: "", name: "" });
            setDistrict({ code: "", name: "" });
            setWard({ code: "", name: "" });
          }}
          required
        />
      </label>
    );
  }

  return (
    <>
      <label className="block">
        <Label idx="03">Tỉnh / Thành</Label>
        <select
          className={fieldCls}
          value={province?.code ?? ""}
          onChange={(e) => pickProvince(e.target.value)}
          required
        >
          <option value="">— Chọn —</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <Label idx="04">Quận / Huyện</Label>
        <select
          className={fieldCls}
          value={district?.code ?? ""}
          onChange={(e) => pickDistrict(e.target.value)}
          disabled={!province}
          required
        >
          <option value="">— Chọn —</option>
          {districts.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <Label idx="05">Phường / Xã</Label>
        <select
          className={fieldCls}
          value={ward?.code ?? ""}
          onChange={(e) =>
            setWard(wards.find((x) => x.code === e.target.value) ?? null)
          }
          disabled={!district}
          required
        >
          <option value="">— Chọn —</option>
          {wards.map((w) => (
            <option key={w.code} value={w.code}>
              {w.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <Label idx="06">Số nhà, tên đường</Label>
        <input
          className={fieldCls}
          value={addressDetail}
          onChange={(e) => setAddressDetail(e.target.value)}
          autoComplete="street-address"
          required
        />
      </label>
    </>
  );
}
