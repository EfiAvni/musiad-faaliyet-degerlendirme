# Kurulum ve Dağıtım

MÜSİAD Faaliyet Değerlendirme Sistemi'nin sıfırdan kurulumu. İki parça var: Laravel API (`backend/`) ve React arayüzü (kök dizin, çıktısı `dist/`).

Arayüz statik dosyalardan ibarettir; API ile aynı sunucuda ya da ayrı bir yerde durabilir. Ayrı duracaksa CORS ayarı zorunludur — [CORS](#cors) bölümüne bakın.

---

## Gereksinimler

| | Sürüm | Not |
|---|---|---|
| PHP | 8.3 veya üzeri | `composer.json` `^8.3` ister |
| PHP eklentileri | `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `tokenizer`, `xml`, `curl`, `gd`, `zip` | `gd` olmadan **PDF raporu 500 döner** |
| Composer | 2.x | |
| MySQL | 8.0 | CI bu sürümle sınanıyor |
| Node.js | 22 veya üzeri | Yalnızca derleme için; sunucuda çalışmaz |

Eklentileri doğrulayın:

```bash
php -m | grep -E "pdo_mysql|mbstring|gd|zip|curl|fileinfo"
```

Zamanlanmış görev **yok** — cron kurmanız gerekmiyor. Kuyruk işçisi de **gerekmiyor**; bildirimler istek içinde senkron yazılır.

---

## 1. Veritabanı

```sql
CREATE DATABASE musiad CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'musiad'@'localhost' IDENTIFIED BY 'GUCLU_BIR_PAROLA';
GRANT ALL PRIVILEGES ON musiad.* TO 'musiad'@'localhost';
FLUSH PRIVILEGES;
```

Karakter seti `utf8mb4` olmalı; şube ve faaliyet adlarında Türkçe karakterler var.

---

## 2. Backend

```bash
cd backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

### .env ayarları

Canlı ortamda mutlaka değiştirilecekler:

```ini
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.faaliyet.musiad.org.tr

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=musiad
DB_USERNAME=musiad
DB_PASSWORD=GUCLU_BIR_PAROLA

# Arayüzün adresi — virgülle birden fazla yazılabilir
CORS_ALLOWED_ORIGINS=https://faaliyet.musiad.org.tr

# Oturum jetonu ömrü, dakika (varsayılan 720 = 12 saat)
SANCTUM_EXPIRATION=720
```

> **`APP_DEBUG=false` şart.** Açık kalırsa hata sayfaları veritabanı bilgilerini ve dosya yollarını dışarıya gösterir.

> **`APP_KEY` bir daha değişmemeli.** Değişirse mevcut oturumlar ve şifrelenmiş veriler geçersiz olur. Yedekleyin.

### Şema ve ilk hesap

```bash
php artisan migrate --force
php artisan db:seed --force
```

Seeder üç demo hesap açar (`DemoUsersSeeder`):

| E-posta | Rol | Parola |
|---|---|---|
| avni.kucuk@musiad.org.tr | Süper Admin | `admin123` |
| huseyin.ozer@musiad.org.tr | Birim Yöneticisi | `birim123` |
| ankara@musiad.org.tr | Şube Yöneticisi | `sube123` |

> **Canlıya çıkmadan bu parolalar değiştirilmeli.** Sistemde kullanıcının kendi parolasını değiştireceği bir ekran **yok**; parolaları yalnızca Süper Admin, Kullanıcılar ekranından atar. İlk Süper Admin'in parolasını da bu yüzden aşağıdaki gibi elle değiştirmeniz gerekir:

```bash
php artisan tinker --execute="
App\Models\User::where('email','avni.kucuk@musiad.org.tr')
    ->update(['password' => Hash::make('YENI_PAROLA')]);
"
```

Demo birim/şube/kullanıcıları istemiyorsanız `db:seed` adımını atlayıp Süper Admin'i doğrudan tinker ile oluşturun.

### Performans ayarları

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

> Bu komutlardan sonra `.env` değişiklikleri **okunmaz**. `.env`'i her değiştirdiğinizde `php artisan config:cache` komutunu tekrar çalıştırın.

### Yazma izinleri

`storage/` ve `bootstrap/cache/` dizinleri web sunucusu kullanıcısına yazılabilir olmalı:

```bash
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
```

### Web kökü

Sanal sunucunun kök dizini **`backend/public`** olmalı — `backend` değil. Aksi halde `.env` dosyası internetten okunabilir hale gelir.

---

## 3. Arayüz

API adresi **derleme anında** gömülür; sonradan değiştirilemez, yeniden derlemek gerekir.

```bash
# proje kökünde
npm ci
VITE_API_URL=https://api.faaliyet.musiad.org.tr/api npm run build
```

`/api` son eki dahil yazılmalı. Çıktı `dist/` klasörüne düşer; içeriğini web sunucusuna kopyalayın.

### SPA yönlendirmesi

Uygulama tek sayfadır ve yönlendirmeyi tarayıcıda yapar. Sunucu, bulunmayan yolları `index.html`'e düşürmelidir:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Apache kullanıyorsanız `dist/` içine bir `.htaccess` ile aynı davranışı kurun.

---

## CORS

Arayüz ile API farklı adreslerdeyse `CORS_ALLOWED_ORIGINS` **zorunludur**. Değişken boş bırakılırsa liste boş kalır ve tarayıcı bütün istekleri engeller — bu bilinçli bir tercih: değişken unutulursa API dışarıya açılmaz.

```ini
CORS_ALLOWED_ORIGINS=https://faaliyet.musiad.org.tr
```

Adresi protokolüyle birlikte, sonunda eğik çizgi olmadan yazın. Birden fazlaysa virgülle ayırın.

Üretim dışı ortamlarda tüm `localhost` portları ayrıca kabul edilir; `APP_ENV=production` iken bu kural devre dışıdır.

---

## Doğrulama

Kurulumdan sonra sırayla:

```bash
# 1. API ayakta mı
curl -i https://api.faaliyet.musiad.org.tr/api/auth/login \
  -X POST -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"email":"...","password":"..."}'
```

`200` ve bir `token` dönmeli. `500` geliyorsa `backend/storage/logs/laravel.log` dosyasına bakın.

2. Arayüzü tarayıcıda açıp giriş yapın. Giriş ekranı geliyor ama giriş çalışmıyorsa, tarayıcı konsolunda CORS hatası olup olmadığına bakın.
3. Süper Admin ile **Raporlar → PDF İndir**'i deneyin. Bu adım `gd` eklentisini sınar; eksikse burada 500 alırsınız.
4. Bir şube hesabıyla girip **Faaliyetlerim**'i açın.

---

## Yedekleme

Yedeklenmesi gerekenler:

- **Veritabanı** — bütün veri burada.
- **`backend/.env`** — özellikle `APP_KEY`.

```bash
mysqldump -u musiad -p --single-transaction --default-character-set=utf8mb4 musiad \
  > musiad-$(date +%F).sql
```

Yüklenen dosya yoktur (sistem faaliyet kayıtlarına dosya eki almaz), `storage/` yalnızca günlük ve önbellek tutar.

---

## Güncelleme

```bash
cd backend
php artisan down                       # bakım moduna al
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan up

cd ..
npm ci
VITE_API_URL=https://api.faaliyet.musiad.org.tr/api npm run build
# dist/ içeriğini web köküne kopyalayın
```

Migration çalıştırmadan önce veritabanı yedeği alın.

---

## Sık karşılaşılanlar

**PDF indirirken 500** — `gd` eklentisi kurulu değil ya da PHP-FPM yeniden başlatılmamış. Eklentiyi kurup `systemctl restart php8.3-fpm` çalıştırın. (`php -m` doğru görünse bile çalışan süreç eski yapılandırmayı taşıyor olabilir.)

**Girişte "Çok fazla hatalı deneme"** — aynı e-posta ve IP için 5 hatalı denemeden sonra 15 dakika kilit devreye girer. Beklemek ya da `php artisan cache:clear` çalıştırmak gerekir.

**Kullanıcı bir cihazda girince diğerinden düşüyor** — bilinçli davranış. Her yeni giriş önceki jetonları geçersiz kılar; aynı hesapla iki cihazda aynı anda çalışılamaz.

**`.env` değişikliği etkisiz** — yapılandırma önbelleklenmiş. `php artisan config:cache` çalıştırın.

**Arayüz açılıyor ama veriler gelmiyor** — büyük olasılıkla `VITE_API_URL` yanlış ya da hiç verilmeden derlenmiş; bu durumda `http://127.0.0.1:8000/api` varsayılanına düşer. Doğru değerle yeniden derleyin.
