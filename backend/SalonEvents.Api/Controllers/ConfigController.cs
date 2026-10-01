using Microsoft.AspNetCore.Mvc;

namespace SalonEvents.Api.Controllers;

/// <summary>
/// Configuración pública de runtime que el frontend lee al arrancar.
/// NO requiere autenticación. Los valores vienen de variables de entorno del
/// backend (WHATSAPP_PHONE / WHATSAPP_MESSAGE), así que se cambian editando el
/// .env del backend y reiniciando el contenedor — sin reconstruir el frontend.
/// </summary>
[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _config;

    public ConfigController(IConfiguration config) => _config = config;

    /// <summary>Devuelve la config pública consumible por cualquier visitante.</summary>
    [HttpGet]
    public ActionResult<object> Get()
    {
        // Solo dígitos en el teléfono (el frontend arma la URL wa.me con esto).
        var rawPhone = _config["WHATSAPP_PHONE"] ?? string.Empty;
        var phone = new string(rawPhone.Where(char.IsDigit).ToArray());
        var message = _config["WHATSAPP_MESSAGE"] ?? string.Empty;

        return Ok(new
        {
            whatsappPhone = phone,
            whatsappMessage = message,
        });
    }
}
