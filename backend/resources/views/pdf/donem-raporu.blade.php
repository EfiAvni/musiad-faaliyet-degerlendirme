<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>{{ $donem['name'] }} — Dönem Raporu</title>
<style>
@verbatim
    @page {
        margin: 100px 36px 60px 36px;
        @top-center {
            content: element(pageHeader);
        }
        @bottom-left {
            content: "MÜSİAD Faaliyet Değerlendirme Sistemi — Gizli / Kurum İçi";
            font-size: 9px;
            color: #9ca3af;
        }
        @bottom-right {
            content: "Sayfa " counter(page) " / " counter(pages);
            font-size: 9px;
            color: #9ca3af;
        }
    }

    * { box-sizing: border-box; }

    body {
        font-family: 'DejaVu Sans', sans-serif;
        color: #1f2937;
        font-size: 11px;
        line-height: 1.5;
    }

    #pageHeader {
        position: running(pageHeader);
        width: 100%;
        border-bottom: 2px solid #B99C1A;
        padding-bottom: 10px;
    }

    #pageHeader table { width: 100%; border-collapse: collapse; }
    #pageHeader .logo-cell { width: 70px; vertical-align: middle; }
    #pageHeader .logo-cell img { width: 56px; height: auto; }
    #pageHeader .title-cell { vertical-align: middle; padding-left: 10px; }
    #pageHeader h1 { margin: 0; font-size: 15px; color: #0A1612; }
    #pageHeader p { margin: 2px 0 0; font-size: 10px; color: #6b7280; }

    h2.section-title {
        font-size: 12px;
        color: #B99C1A;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid #eee;
        padding-bottom: 4px;
        margin: 18px 0 8px;
    }

    .kpi-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .kpi-table td {
        width: 20%;
        padding: 10px 8px;
        border: 1px solid #eee;
        text-align: center;
        vertical-align: top;
    }
    .kpi-value { font-size: 16px; font-weight: bold; color: #0A1612; display: block; }
    .kpi-label { font-size: 9px; color: #6b7280; display: block; margin-top: 2px; }

    table.data { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    table.data th {
        background: #0A1612;
        color: #ffffff;
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        padding: 6px 8px;
        text-align: left;
    }
    table.data td {
        padding: 6px 8px;
        border-bottom: 1px solid #eee;
        font-size: 10px;
        vertical-align: middle;
    }
    table.data tr:nth-child(even) td { background: #FAFAF8; }
    .num { text-align: right; }
    .rank {
        display: inline-block;
        width: 16px; height: 16px;
        border-radius: 50%;
        background: #B99C1A;
        color: #fff;
        text-align: center;
        font-size: 8.5px;
        line-height: 16px;
        margin-right: 4px;
    }
    .bar-track { background: #eee; border-radius: 3px; height: 8px; width: 100px; display: inline-block; vertical-align: middle; }
    .bar-fill { background: #B99C1A; border-radius: 3px; height: 8px; display: block; }
    .bar-pct { font-size: 9px; color: #6b7280; margin-left: 4px; }
    .empty-note { color: #9ca3af; font-size: 10px; font-style: italic; padding: 10px 0; }
    .scope-note { font-size: 10px; color: #6b7280; margin-top: -4px; margin-bottom: 10px; }
@endverbatim
</style>
</head>
<body>

<div id="pageHeader">
    <table>
        <tr>
            <td class="logo-cell">
                @if($logoBase64)
                    <img src="data:image/png;base64,{{ $logoBase64 }}" alt="MÜSİAD">
                @endif
            </td>
            <td class="title-cell">
                <h1>MÜSİAD Faaliyet Değerlendirme Sistemi</h1>
                <p>Dönem Raporu — {{ $olusturmaTarihi }}</p>
            </td>
        </tr>
    </table>
</div>

<h1 style="font-size:18px; color:#0A1612; margin-bottom: 2px;">{{ $donem['name'] }}</h1>
<p style="color:#6b7280; margin-top:0;">
    {{ \Carbon\Carbon::parse($donem['start_date'])->translatedFormat('d F Y') }}
    –
    {{ \Carbon\Carbon::parse($donem['end_date'])->translatedFormat('d F Y') }}
    · {{ $donem['status'] === 'completed' ? 'Tamamlandı' : ($donem['status'] === 'active' ? 'Aktif' : 'Taslak') }}
</p>
<p class="scope-note">
    Şube Kapsamı:
    {{ $donem['tum_subeler'] ? 'Tüm Şubeler' : (collect($donem['subeler'])->pluck('name')->join(', ') ?: 'Şube seçilmedi') }}
</p>

<h2 class="section-title">Genel Özet</h2>
<table class="kpi-table">
    <tr>
        <td><span class="kpi-value">{{ $genel['toplam_sube'] }}</span><span class="kpi-label">Kapsamdaki Şube</span></td>
        <td><span class="kpi-value">{{ $genel['toplam_faaliyet'] }}</span><span class="kpi-label">Toplam Faaliyet</span></td>
        <td><span class="kpi-value">{{ $genel['toplam_hedef'] }}</span><span class="kpi-label">Toplam Hedef</span></td>
        <td><span class="kpi-value">{{ $genel['toplam_kayit'] }}</span><span class="kpi-label">Toplam Kayıt</span></td>
        <td><span class="kpi-value">%{{ round($genel['ortalama_tamamlanma'] * 100) }}</span><span class="kpi-label">Ort. Tamamlanma</span></td>
    </tr>
</table>
@if($genel['en_iyi_sube_adi'])
    <p style="font-size:10px; color:#6b7280;">
        En yüksek performans: <strong style="color:#0A1612;">{{ $genel['en_iyi_sube_adi'] }}</strong>
        (%{{ round(($genel['en_iyi_sube_orani'] ?? 0) * 100) }} tamamlanma)
    </p>
@endif

<h2 class="section-title">Şube Bazlı Performans</h2>
@if(count($subeBazli) === 0)
    <p class="empty-note">Bu dönem kapsamında değerlendirilecek şube bulunmuyor.</p>
@else
    <table class="data">
        <thead>
        <tr>
            <th>#</th>
            <th>Şube</th>
            <th class="num">Kayıt</th>
            <th class="num">Puan</th>
            <th>Tamamlanma</th>
        </tr>
        </thead>
        <tbody>
        @foreach($subeBazli as $i => $s)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td>{{ $s['sube_adi'] }}</td>
                <td class="num">{{ $s['kayit_sayisi'] }}</td>
                <td class="num">{{ $s['toplam_puan'] }} / {{ $s['max_puan'] }}</td>
                <td>
                    <span class="bar-track"><span class="bar-fill" style="width:{{ round($s['tamamlanma_orani'] * 100) }}%;"></span></span>
                    <span class="bar-pct">%{{ round($s['tamamlanma_orani'] * 100) }}</span>
                </td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2 class="section-title">Faaliyet Bazlı Performans</h2>
@if(count($faaliyetBazli) === 0)
    <p class="empty-note">Bu döneme tanımlanmış faaliyet bulunmuyor.</p>
@else
    <table class="data">
        <thead>
        <tr>
            <th>Faaliyet</th>
            <th class="num">Puan</th>
            <th class="num">Hedef</th>
            <th class="num">Toplam Kayıt</th>
            <th class="num">Katılan Şube</th>
            <th>Doluluk</th>
        </tr>
        </thead>
        <tbody>
        @foreach($faaliyetBazli as $f)
            <tr>
                <td>{{ $f['title'] }}</td>
                <td class="num">{{ $f['puan'] }}</td>
                <td class="num">{{ $f['hedef'] }}</td>
                <td class="num">{{ $f['toplam_kayit'] }}</td>
                <td class="num">{{ $f['katilan_sube_sayisi'] }} / {{ $genel['toplam_sube'] }}</td>
                <td>
                    <span class="bar-track"><span class="bar-fill" style="width:{{ min(100, round($f['doluluk_orani'] * 100)) }}%;"></span></span>
                    <span class="bar-pct">%{{ round($f['doluluk_orani'] * 100) }}</span>
                </td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

<h2 class="section-title">Aylık Kayıt Dağılımı</h2>
@if(count($aylikTrend) === 0)
    <p class="empty-note">Bu döneme ait değerlendirme ayı bulunmuyor.</p>
@else
    @php $maxAyKayit = max(1, collect($aylikTrend)->max('kayit_sayisi')); @endphp
    <table class="data">
        <thead>
        <tr>
            <th>Ay</th>
            <th class="num">Kayıt Sayısı</th>
            <th>Dağılım</th>
        </tr>
        </thead>
        <tbody>
        @foreach($aylikTrend as $ay)
            <tr>
                <td>{{ $ay['ay'] }}</td>
                <td class="num">{{ $ay['kayit_sayisi'] }}</td>
                <td>
                    <span class="bar-track"><span class="bar-fill" style="width:{{ round(($ay['kayit_sayisi'] / $maxAyKayit) * 100) }}%;"></span></span>
                </td>
            </tr>
        @endforeach
        </tbody>
    </table>
@endif

</body>
</html>
